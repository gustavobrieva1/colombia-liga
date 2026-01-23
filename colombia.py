"""
Colombian Liga DIMAYOR - Interactive Player Stats CLI.

Scrapes full squad data + match statistics from SofaScore.
Caches results locally. Use --update to refresh data.

Usage:
  python3 colombia.py           # Load from cache or scrape
  python3 colombia.py --update  # Force refresh from SofaScore
"""

import json
import os
import time
import sys
from pathlib import Path

try:
    import tls_client
except ImportError:
    print("Install tls_client: pip install tls-client")
    sys.exit(1)

try:
    from simple_term_menu import TerminalMenu
except ImportError:
    print("Install simple-term-menu: pip install simple-term-menu")
    sys.exit(1)


LEAGUE_ID = 11539  # Primera A Apertura
SEASON_ID = 88503  # 2026
CACHE_FILE = Path(__file__).parent / "data" / "colombia_cache.json"

STATS_FIELDS = [
    "rating", "appearances", "started", "minutesPlayed",
    "goals", "assists", "expectedGoals", "bigChancesMissed",
    "totalShots", "shotsOnTarget", "goalConversionPercentage",
    "accuratePasses", "accuratePassesPercentage", "keyPasses",
    "bigChancesCreated", "accurateCrosses", "accurateCrossesPercentage",
    "tackles", "interceptions", "clearances",
    "groundDuelsWon", "groundDuelsWonPercentage",
    "aerialDuelsWon", "aerialDuelsWonPercentage",
    "successfulDribbles", "successfulDribblesPercentage",
    "yellowCards", "redCards", "fouls", "wasFouled",
    "saves", "cleanSheets", "errorLeadToGoal",
]

POSITION_MAP = {"G": "GK", "D": "DEF", "M": "MID", "F": "FWD"}


def create_session():
    session = tls_client.Session(
        client_identifier="chrome_120",
        random_tls_extension_order=True,
    )
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.sofascore.com/",
    })
    return session


def api_get(session, url):
    """Make API request with retry on rate limit."""
    for attempt in range(3):
        try:
            resp = session.get(url)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                print("  Rate limited, waiting...")
                time.sleep(5)
            else:
                return None
        except Exception as e:
            print(f"  Request error: {e}")
            time.sleep(2)
    return None


def scrape_teams(session):
    """Get all teams from league standings."""
    print("  Fetching teams...")
    url = (
        f"https://www.sofascore.com/api/v1/unique-tournament/{LEAGUE_ID}"
        f"/season/{SEASON_ID}/standings/total"
    )
    data = api_get(session, url)
    if not data:
        return []

    standings = data.get("standings", [{}])
    rows = standings[0].get("rows", []) if standings else []
    teams = []
    for r in rows:
        t = r.get("team", {})
        teams.append({
            "id": t.get("id"),
            "name": t.get("name", "Unknown"),
            "position": r.get("position", 0),
            "wins": r.get("wins", 0),
            "draws": r.get("draws", 0),
            "losses": r.get("losses", 0),
            "points": r.get("points", 0),
            "goals_for": r.get("scoresFor", 0),
            "goals_against": r.get("scoresAgainst", 0),
        })

    print(f"  Found {len(teams)} teams")
    return teams


def scrape_squad(session, team_id, team_name):
    """Get full squad for a team."""
    url = f"https://www.sofascore.com/api/v1/team/{team_id}/players"
    data = api_get(session, url)
    if not data:
        return []

    players = []
    for entry in data.get("players", []):
        p = entry.get("player", {})
        players.append({
            "id": p.get("id"),
            "name": p.get("name", "Unknown"),
            "position": POSITION_MAP.get(p.get("position", ""), p.get("position", "")),
            "team": team_name,
            "team_id": team_id,
            "country": p.get("country", {}).get("name", ""),
            "height": p.get("height", 0),
            "age": _calc_age(p.get("dateOfBirthTimestamp")),
            # Stats fields (filled later from statistics endpoint)
            "rating": 0.0,
            "appearances": 0,
            "started": 0,
            "minutes": 0,
            "goals": 0,
            "assists": 0,
            "xg": 0.0,
            "shots": 0,
            "shots_on_target": 0,
            "goal_conversion": 0.0,
            "big_chances_missed": 0,
            "passes_acc": 0.0,
            "key_passes": 0,
            "big_chances_created": 0,
            "crosses_acc": 0.0,
            "tackles": 0,
            "interceptions": 0,
            "clearances": 0,
            "ground_duels_won_pct": 0.0,
            "aerial_duels_won_pct": 0.0,
            "dribbles_pct": 0.0,
            "yellow_cards": 0,
            "red_cards": 0,
            "fouls": 0,
            "was_fouled": 0,
            "saves": 0,
            "clean_sheets": 0,
            "errors_to_goal": 0,
        })

    return players


def _calc_age(timestamp):
    """Calculate age from birth timestamp."""
    if not timestamp:
        return 0
    import datetime
    birth = datetime.datetime.fromtimestamp(timestamp)
    today = datetime.datetime.now()
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def scrape_stats(session):
    """Scrape player statistics (only players who have played)."""
    print("  Fetching player statistics...")
    fields = ",".join(STATS_FIELDS)
    stats_by_id = {}
    offset = 0
    limit = 100

    while True:
        url = (
            f"https://www.sofascore.com/api/v1/unique-tournament/{LEAGUE_ID}"
            f"/season/{SEASON_ID}/statistics"
            f"?limit={limit}&offset={offset}&order=-rating"
            f"&accumulation=total&fields={fields}"
            f"&filters=position.in.G~D~M~F"
        )

        data = api_get(session, url)
        if not data:
            break

        results = data.get("results", [])
        if not results:
            break

        for r in results:
            player_id = r.get("player", {}).get("id")
            if player_id:
                stats_by_id[player_id] = {
                    "rating": r.get("rating") or 0.0,
                    "appearances": r.get("appearances") or 0,
                    "started": r.get("started") or 0,
                    "minutes": r.get("minutesPlayed") or 0,
                    "goals": r.get("goals") or 0,
                    "assists": r.get("assists") or 0,
                    "xg": r.get("expectedGoals") or 0.0,
                    "shots": r.get("totalShots") or 0,
                    "shots_on_target": r.get("shotsOnTarget") or 0,
                    "goal_conversion": r.get("goalConversionPercentage") or 0.0,
                    "big_chances_missed": r.get("bigChancesMissed") or 0,
                    "passes_acc": r.get("accuratePassesPercentage") or 0.0,
                    "key_passes": r.get("keyPasses") or 0,
                    "big_chances_created": r.get("bigChancesCreated") or 0,
                    "crosses_acc": r.get("accurateCrossesPercentage") or 0.0,
                    "tackles": r.get("tackles") or 0,
                    "interceptions": r.get("interceptions") or 0,
                    "clearances": r.get("clearances") or 0,
                    "ground_duels_won_pct": r.get("groundDuelsWonPercentage") or 0.0,
                    "aerial_duels_won_pct": r.get("aerialDuelsWonPercentage") or 0.0,
                    "dribbles_pct": r.get("successfulDribblesPercentage") or 0.0,
                    "yellow_cards": r.get("yellowCards") or 0,
                    "red_cards": r.get("redCards") or 0,
                    "fouls": r.get("fouls") or 0,
                    "was_fouled": r.get("wasFouled") or 0,
                    "saves": r.get("saves") or 0,
                    "clean_sheets": r.get("cleanSheets") or 0,
                    "errors_to_goal": r.get("errorLeadToGoal") or 0,
                }

        print(f"  Stats loaded: {len(stats_by_id)} players...", end="\r")

        if len(results) < limit:
            break

        offset += limit
        time.sleep(1)

    print(f"  Stats loaded: {len(stats_by_id)} players     ")
    return stats_by_id


def scrape_all(session):
    """Scrape everything: teams, squads, and stats."""
    print("\nScraping Liga DIMAYOR 2026 from SofaScore...\n")

    teams = scrape_teams(session)
    if not teams:
        return None

    # Get stats first (indexed by player ID)
    time.sleep(1)
    stats_by_id = scrape_stats(session)

    # Get full squad for each team
    all_teams = {}
    for i, team in enumerate(teams):
        print(f"  Squads: {i + 1}/{len(teams)} - {team['name']:<30}", end="\r")
        time.sleep(0.8)
        players = scrape_squad(session, team["id"], team["name"])

        # Merge stats into squad players
        for player in players:
            pid = player["id"]
            if pid in stats_by_id:
                player.update(stats_by_id[pid])

        # Sort: players with stats first (by rating), then others alphabetically
        players.sort(key=lambda p: (-p["rating"], p["name"]))

        all_teams[team["name"]] = {
            "info": team,
            "players": players,
        }

    print(f"  Squads: {len(teams)}/{len(teams)} loaded.              ")

    total_players = sum(len(t["players"]) for t in all_teams.values())
    print(f"\n  Total: {len(all_teams)} teams, {total_players} players\n")

    return all_teams


def save_cache(data):
    """Save scraped data to cache file."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    cache = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "teams": data,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    print(f"  Cached to {CACHE_FILE}")


def load_cache():
    """Load data from cache file."""
    if not CACHE_FILE.exists():
        return None
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        cache = json.load(f)
    updated = cache.get("updated_at", "unknown")
    teams = cache.get("teams", {})
    total = sum(len(t["players"]) for t in teams.values())
    print(f"  Loaded from cache ({updated}) - {len(teams)} teams, {total} players")
    return teams


# ─── Helpers ──────────────────────────────────────────────────


def _all_players(teams):
    """Get flat list of all players with stats."""
    players = []
    for team_data in teams.values():
        for p in team_data["players"]:
            if p["appearances"] > 0:
                players.append(p)
    return players


def _wait():
    input("  Press Enter to go back...")


# ─── Display ──────────────────────────────────────────────────


def display_player_stats(player):
    """Display full stats for a player."""
    has_stats = player["appearances"] > 0

    print("\n" + "=" * 50)
    print(f"  {player['name']}  ({player['position']})")
    print(f"  {player.get('team', '')}")
    if player.get("age"):
        print(f"  Age: {player['age']}  Country: {player.get('country', '-')}")
    print("=" * 50)

    if not has_stats:
        print("\n  No match statistics yet this season.\n")
        return

    print(f"\n  General")
    print(f"  {'─' * 30}")
    print(f"  Rating:        {player['rating']:.2f}")
    print(f"  Appearances:   {player['appearances']} ({player['started']} started)")
    print(f"  Minutes:       {player['minutes']}")

    if player["position"] in ("FWD", "MID") or player["goals"] or player["assists"]:
        print(f"\n  Attack")
        print(f"  {'─' * 30}")
        print(f"  Goals:         {player['goals']}")
        print(f"  Assists:       {player['assists']}")
        if player["xg"]:
            print(f"  xG:            {player['xg']:.2f}")
        if player["shots"]:
            print(f"  Shots:         {player['shots']} ({player['shots_on_target']} on target)")
        if player["goal_conversion"]:
            print(f"  Conversion:    {player['goal_conversion']:.1f}%")
        if player["big_chances_missed"]:
            print(f"  Big chances missed: {player['big_chances_missed']}")

    print(f"\n  Passing")
    print(f"  {'─' * 30}")
    if player["passes_acc"]:
        print(f"  Pass accuracy: {player['passes_acc']:.1f}%")
    print(f"  Key passes:    {player['key_passes']}")
    if player["big_chances_created"]:
        print(f"  Big chances created: {player['big_chances_created']}")
    if player["crosses_acc"]:
        print(f"  Cross accuracy: {player['crosses_acc']:.1f}%")

    if player["position"] in ("DEF", "GK") or player["tackles"] or player["interceptions"]:
        print(f"\n  Defense")
        print(f"  {'─' * 30}")
        print(f"  Tackles:       {player['tackles']}")
        print(f"  Interceptions: {player['interceptions']}")
        print(f"  Clearances:    {player['clearances']}")

    print(f"\n  Duels")
    print(f"  {'─' * 30}")
    if player["ground_duels_won_pct"]:
        print(f"  Ground duels:  {player['ground_duels_won_pct']:.1f}% won")
    if player["aerial_duels_won_pct"]:
        print(f"  Aerial duels:  {player['aerial_duels_won_pct']:.1f}% won")
    if player["dribbles_pct"]:
        print(f"  Dribbles:      {player['dribbles_pct']:.1f}% success")

    if player["position"] == "GK":
        print(f"\n  Goalkeeping")
        print(f"  {'─' * 30}")
        print(f"  Saves:         {player['saves']}")
        print(f"  Clean sheets:  {player['clean_sheets']}")

    print(f"\n  Discipline")
    print(f"  {'─' * 30}")
    print(f"  Yellow cards:  {player['yellow_cards']}")
    print(f"  Red cards:     {player['red_cards']}")
    print(f"  Fouls:         {player['fouls']}")
    print(f"  Was fouled:    {player['was_fouled']}")
    if player["errors_to_goal"]:
        print(f"  Errors -> goal: {player['errors_to_goal']}")

    print()


def display_comparison(p1, p2):
    """Display side-by-side comparison of two players."""
    w = 18  # column width

    print("\n" + "=" * 60)
    print(f"  {'COMPARACION':^56}")
    print("=" * 60)
    print(f"  {'':<20} {p1['name']:>{w}}  vs  {p2['name']:<{w}}")
    print(f"  {'':<20} {p1.get('team','')[:w]:>{w}}      {p2.get('team','')[:w]:<{w}}")
    print(f"  {'':<20} {p1['position']:>{w}}      {p2['position']:<{w}}")
    print(f"  {'─' * 56}")

    rows = [
        ("Rating", "rating", ".2f"),
        ("Appearances", "appearances", "d"),
        ("Minutes", "minutes", "d"),
        ("Goals", "goals", "d"),
        ("Assists", "assists", "d"),
        ("xG", "xg", ".2f"),
        ("Shots", "shots", "d"),
        ("Shots on target", "shots_on_target", "d"),
        ("Goal conv. %", "goal_conversion", ".1f"),
        ("Pass acc. %", "passes_acc", ".1f"),
        ("Key passes", "key_passes", "d"),
        ("Big chances created", "big_chances_created", "d"),
        ("Tackles", "tackles", "d"),
        ("Interceptions", "interceptions", "d"),
        ("Clearances", "clearances", "d"),
        ("Ground duels %", "ground_duels_won_pct", ".1f"),
        ("Aerial duels %", "aerial_duels_won_pct", ".1f"),
        ("Dribbles %", "dribbles_pct", ".1f"),
        ("Yellow cards", "yellow_cards", "d"),
        ("Red cards", "red_cards", "d"),
        ("Fouls", "fouls", "d"),
        ("Was fouled", "was_fouled", "d"),
        ("Saves", "saves", "d"),
        ("Clean sheets", "clean_sheets", "d"),
    ]

    for label, key, fmt in rows:
        v1 = p1.get(key, 0)
        v2 = p2.get(key, 0)
        if v1 == 0 and v2 == 0:
            continue

        s1 = f"{v1:{fmt}}"
        s2 = f"{v2:{fmt}}"

        # Highlight winner
        better_is_lower = key in ("fouls", "yellow_cards", "red_cards", "errors_to_goal")
        if better_is_lower:
            marker1 = " *" if v1 < v2 and v1 > 0 else "  "
            marker2 = " *" if v2 < v1 and v2 > 0 else "  "
        else:
            marker1 = " *" if v1 > v2 else "  "
            marker2 = " *" if v2 > v1 else "  "

        print(f"  {label:<20} {s1:>{w-2}}{marker1}      {s2:<{w-2}}{marker2}")

    print(f"\n  (* = better)\n")


# ─── Rankings ─────────────────────────────────────────────────


RANKING_CATEGORIES = [
    ("Top Rating", "rating", ".2f", False),
    ("Top Goleadores", "goals", "d", False),
    ("Top Asistidores", "assists", "d", False),
    ("Top xG (Goles Esperados)", "xg", ".2f", False),
    ("Top Pases Clave", "key_passes", "d", False),
    ("Top Chances Creadas", "big_chances_created", "d", False),
    ("Top Tackles", "tackles", "d", False),
    ("Top Intercepciones", "interceptions", "d", False),
    ("Top Despejes", "clearances", "d", False),
    ("Top Duelos Terrestres %", "ground_duels_won_pct", ".1f", True),
    ("Top Duelos Aereos %", "aerial_duels_won_pct", ".1f", True),
    ("Top Regates %", "dribbles_pct", ".1f", True),
    ("Top Tiros", "shots", "d", False),
    ("Top Tiros al Arco", "shots_on_target", "d", False),
    ("Top Atajadas (GK)", "saves", "d", False),
    ("Top Vallas Invictas (GK)", "clean_sheets", "d", False),
    ("Mas Faltas Cometidas", "fouls", "d", False),
    ("Mas Veces Derribado", "was_fouled", "d", False),
    ("Mas Tarjetas Amarillas", "yellow_cards", "d", False),
    ("Mas Tarjetas Rojas", "red_cards", "d", False),
]


def rankings_menu(teams):
    """Show ranking categories and display top 15."""
    while True:
        entries = [cat[0] for cat in RANKING_CATEGORIES]
        entries.append("<- Back")

        title = "\n  Rankings - Selecciona categoria\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        label, key, fmt, pct_filter = RANKING_CATEGORIES[idx]
        players = _all_players(teams)

        # For percentage stats, filter players with minimum appearances
        if pct_filter:
            min_apps = max(1, max(p["appearances"] for p in players) // 2) if players else 1
            players = [p for p in players if p["appearances"] >= min_apps]

        players.sort(key=lambda p: p.get(key, 0), reverse=True)
        top = players[:15]

        print(f"\n  {'─' * 60}")
        print(f"  {label}")
        print(f"  {'─' * 60}")
        print(f"  {'#':<3} {'Jugador':<25} {'Equipo':<22} {'Valor':>8}")
        print(f"  {'─' * 60}")

        for i, p in enumerate(top, 1):
            val = p.get(key, 0)
            val_str = f"{val:{fmt}}" + ("%" if pct_filter else "")
            print(f"  {i:<3} {p['name']:<25} {p.get('team', '')[:20]:<22} {val_str:>8}")

        print()
        _wait()


# ─── Comparison ───────────────────────────────────────────────


def comparison_menu(teams):
    """Select two players and compare them."""
    all_p = _all_players(teams)
    all_p.sort(key=lambda p: p["rating"], reverse=True)

    player_entries = [
        f"{p['position']:<4} {p['name']:<25} {p.get('team', '')[:18]:<18} {p['rating']:.2f}"
        for p in all_p
    ]

    print("\n  Selecciona el PRIMER jugador:")
    menu1 = TerminalMenu(
        player_entries + ["<- Back"],
        title="\n  Comparar - Jugador 1\n",
        menu_cursor_style=("fg_cyan", "bold"),
        menu_highlight_style=("bg_cyan", "fg_black"),
    )
    idx1 = menu1.show()
    if idx1 is None or idx1 == len(player_entries):
        return

    print(f"\n  Selecciona el SEGUNDO jugador:")
    menu2 = TerminalMenu(
        player_entries + ["<- Back"],
        title=f"\n  Comparar con {all_p[idx1]['name']} - Jugador 2\n",
        menu_cursor_style=("fg_cyan", "bold"),
        menu_highlight_style=("bg_cyan", "fg_black"),
    )
    idx2 = menu2.show()
    if idx2 is None or idx2 == len(player_entries):
        return

    display_comparison(all_p[idx1], all_p[idx2])
    _wait()


# ─── Tactical Analysis ───────────────────────────────────────


TACTICAL_CATEGORIES = [
    ("Mas Goles", "goals", False),
    ("Mas Pases Precisos %", "passes_acc", True),
    ("Mas Pases Clave", "key_passes", False),
    ("Mas Centros Precisos %", "crosses_acc", True),
    ("Mas Chances Creadas", "big_chances_created", False),
    ("Mas Tiros", "shots", False),
    ("Mas Tiros al Arco", "shots_on_target", False),
    ("Mas Tackles", "tackles", False),
    ("Mas Intercepciones", "interceptions", False),
    ("Mas Despejes", "clearances", False),
    ("Mejores Duelos Terrestres %", "ground_duels_won_pct", True),
    ("Mejores Duelos Aereos %", "aerial_duels_won_pct", True),
    ("Mas Regates %", "dribbles_pct", True),
    ("Mas Faltas Cometidas", "fouls", False),
    ("Mas Tarjetas Amarillas", "yellow_cards", False),
    ("Mas Veces Derribados", "was_fouled", False),
]


def tactical_menu(teams):
    """Show tactical analysis per team."""
    while True:
        entries = [cat[0] for cat in TACTICAL_CATEGORIES]
        entries.append("<- Back")

        title = "\n  Analisis Tactico - Ranking por Equipo\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        label, key, is_avg = TACTICAL_CATEGORIES[idx]

        # Calculate team totals/averages
        team_stats = []
        for name, team_data in teams.items():
            players = [p for p in team_data["players"] if p["appearances"] > 0]
            if not players:
                continue

            if is_avg:
                # Weighted average by minutes
                total_mins = sum(p["minutes"] for p in players)
                if total_mins > 0:
                    val = sum(p.get(key, 0) * p["minutes"] for p in players) / total_mins
                else:
                    val = 0
            else:
                val = sum(p.get(key, 0) for p in players)

            # Find top contributor
            top_player = max(players, key=lambda p: p.get(key, 0))
            team_stats.append((name, val, top_player["name"], top_player.get(key, 0)))

        team_stats.sort(key=lambda x: x[1], reverse=True)

        print(f"\n  {'─' * 70}")
        print(f"  {label} (por equipo)")
        print(f"  {'─' * 70}")

        fmt = ".1f" if is_avg else ".0f"
        header_val = "Promedio" if is_avg else "Total"
        print(f"  {'#':<3} {'Equipo':<25} {header_val:>8}   {'Top Jugador':<22} {'Val':>5}")
        print(f"  {'─' * 70}")

        for i, (name, val, top_name, top_val) in enumerate(team_stats, 1):
            val_str = f"{val:{fmt}}" + ("%" if is_avg else "")
            top_str = f"{top_val:{fmt}}"
            print(f"  {i:<3} {name:<25} {val_str:>8}   {top_name[:20]:<22} {top_str:>5}")

        print()
        _wait()


# ─── League Analysis ──────────────────────────────────────────


def league_best_xi(teams):
    """Show the best XI of the league by rating."""
    players = _all_players(teams)

    formation = {"GK": 1, "DEF": 4, "MID": 3, "FWD": 3}
    best_xi = []

    for pos, count in formation.items():
        pos_players = sorted(
            [p for p in players if p["position"] == pos],
            key=lambda p: p["rating"],
            reverse=True,
        )
        best_xi.extend(pos_players[:count])

    print(f"\n  {'═' * 55}")
    print(f"  {'MEJOR XI - Liga DIMAYOR 2026':^55}")
    print(f"  {'(4-3-3 por Rating)':^55}")
    print(f"  {'═' * 55}")
    print(f"  {'Pos':<4} {'Jugador':<25} {'Equipo':<20} {'Rating':>6}")
    print(f"  {'─' * 55}")

    for p in best_xi:
        print(f"  {p['position']:<4} {p['name']:<25} {p.get('team', '')[:18]:<20} {p['rating']:>6.2f}")

    avg = sum(p["rating"] for p in best_xi) / len(best_xi) if best_xi else 0
    total_goals = sum(p["goals"] for p in best_xi)
    total_assists = sum(p["assists"] for p in best_xi)
    print(f"  {'─' * 55}")
    print(f"  Rating promedio: {avg:.2f}  |  Goles: {total_goals}  |  Asistencias: {total_assists}")
    print()


def league_xg_analysis(teams):
    """Show xG vs actual goals per team."""
    print(f"\n  {'─' * 60}")
    print(f"  {'xG vs Goles Reales (por equipo)':^60}")
    print(f"  {'─' * 60}")
    print(f"  {'Equipo':<25} {'Goles':>5} {'xG':>6} {'Diff':>6} {'Eficiencia':>10}")
    print(f"  {'─' * 60}")

    team_xg = []
    for name, team_data in teams.items():
        players = [p for p in team_data["players"] if p["appearances"] > 0]
        goals = sum(p["goals"] for p in players)
        xg = sum(p.get("xg", 0) for p in players)
        team_xg.append((name, goals, xg))

    team_xg.sort(key=lambda x: x[1], reverse=True)

    for name, goals, xg in team_xg:
        diff = goals - xg
        eff = (goals / xg * 100) if xg > 0 else 0
        diff_str = f"+{diff:.1f}" if diff >= 0 else f"{diff:.1f}"
        print(f"  {name:<25} {goals:>5} {xg:>6.1f} {diff_str:>6} {eff:>9.0f}%")

    print()


def league_discipline(teams):
    """Show discipline summary per team."""
    print(f"\n  {'─' * 65}")
    print(f"  {'Disciplina por Equipo':^65}")
    print(f"  {'─' * 65}")
    print(f"  {'Equipo':<25} {'Amarillas':>9} {'Rojas':>5} {'Faltas':>6} {'Derribados':>10}")
    print(f"  {'─' * 65}")

    team_disc = []
    for name, team_data in teams.items():
        players = [p for p in team_data["players"] if p["appearances"] > 0]
        yellows = sum(p["yellow_cards"] for p in players)
        reds = sum(p["red_cards"] for p in players)
        fouls = sum(p["fouls"] for p in players)
        fouled = sum(p["was_fouled"] for p in players)
        team_disc.append((name, yellows, reds, fouls, fouled))

    team_disc.sort(key=lambda x: x[1] + x[2] * 3, reverse=True)

    for name, yellows, reds, fouls, fouled in team_disc:
        print(f"  {name:<25} {yellows:>9} {reds:>5} {fouls:>6} {fouled:>10}")

    print()


def league_analysis_menu(teams):
    """League-wide analysis submenu."""
    while True:
        entries = [
            "Mejor XI (por Rating)",
            "xG vs Goles Reales",
            "Tabla de Disciplina",
            "Ranking por Posicion (GK/DEF/MID/FWD)",
            "<- Back",
        ]

        title = "\n  Analisis de Liga\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        if idx == 0:
            league_best_xi(teams)
            _wait()
        elif idx == 1:
            league_xg_analysis(teams)
            _wait()
        elif idx == 2:
            league_discipline(teams)
            _wait()
        elif idx == 3:
            position_ranking_menu(teams)


def position_ranking_menu(teams):
    """Show top players per position."""
    while True:
        entries = ["Porteros (GK)", "Defensas (DEF)", "Mediocampistas (MID)", "Delanteros (FWD)", "<- Back"]
        title = "\n  Ranking por Posicion\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        pos_map = {0: "GK", 1: "DEF", 2: "MID", 3: "FWD"}
        pos = pos_map[idx]
        players = [p for p in _all_players(teams) if p["position"] == pos]
        players.sort(key=lambda p: p["rating"], reverse=True)
        top = players[:20]

        print(f"\n  {'─' * 65}")
        print(f"  Top {pos}")
        print(f"  {'─' * 65}")

        if pos == "GK":
            print(f"  {'#':<3} {'Jugador':<22} {'Equipo':<18} {'Rat':>4} {'Saves':>5} {'CS':>3}")
            print(f"  {'─' * 65}")
            for i, p in enumerate(top, 1):
                print(f"  {i:<3} {p['name']:<22} {p.get('team','')[:16]:<18} {p['rating']:>4.1f} {p['saves']:>5} {p['clean_sheets']:>3}")
        elif pos == "DEF":
            print(f"  {'#':<3} {'Jugador':<22} {'Equipo':<18} {'Rat':>4} {'Tck':>4} {'Int':>4} {'Clr':>4} {'G':>2}")
            print(f"  {'─' * 65}")
            for i, p in enumerate(top, 1):
                print(f"  {i:<3} {p['name']:<22} {p.get('team','')[:16]:<18} {p['rating']:>4.1f} {p['tackles']:>4} {p['interceptions']:>4} {p['clearances']:>4} {p['goals']:>2}")
        elif pos == "MID":
            print(f"  {'#':<3} {'Jugador':<22} {'Equipo':<18} {'Rat':>4} {'G':>2} {'A':>2} {'KP':>3} {'Pass%':>5}")
            print(f"  {'─' * 65}")
            for i, p in enumerate(top, 1):
                print(f"  {i:<3} {p['name']:<22} {p.get('team','')[:16]:<18} {p['rating']:>4.1f} {p['goals']:>2} {p['assists']:>2} {p['key_passes']:>3} {p['passes_acc']:>5.1f}")
        else:  # FWD
            print(f"  {'#':<3} {'Jugador':<22} {'Equipo':<18} {'Rat':>4} {'G':>2} {'A':>2} {'xG':>5} {'Shots':>5}")
            print(f"  {'─' * 65}")
            for i, p in enumerate(top, 1):
                print(f"  {i:<3} {p['name']:<22} {p.get('team','')[:16]:<18} {p['rating']:>4.1f} {p['goals']:>2} {p['assists']:>2} {p['xg']:>5.2f} {p['shots']:>5}")

        print()
        _wait()


# ─── Search ───────────────────────────────────────────────────


def search_menu(teams):
    """Search players by name or filter by criteria."""
    while True:
        entries = [
            "Buscar por nombre",
            "Filtrar: FWD con goles",
            "Filtrar: MID creativos (key passes + assists)",
            "Filtrar: DEF solidos (tackles + interceptions)",
            "Filtrar: Jovenes destacados (< 23 anos)",
            "Filtrar personalizado",
            "<- Back",
        ]

        title = "\n  Buscar / Filtrar Jugadores\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        players = _all_players(teams)

        if idx == 0:
            _search_by_name(teams)
        elif idx == 1:
            filtered = [p for p in players if p["position"] == "FWD" and p["goals"] > 0]
            filtered.sort(key=lambda p: p["goals"], reverse=True)
            _display_search_results(filtered, "Delanteros con goles", "goals")
        elif idx == 2:
            filtered = [p for p in players if p["position"] == "MID"]
            filtered.sort(key=lambda p: p["key_passes"] + p["assists"] * 2, reverse=True)
            _display_search_results(filtered[:20], "Mediocampistas creativos", "key_passes")
        elif idx == 3:
            filtered = [p for p in players if p["position"] == "DEF"]
            filtered.sort(key=lambda p: p["tackles"] + p["interceptions"], reverse=True)
            _display_search_results(filtered[:20], "Defensas solidos", "tackles")
        elif idx == 4:
            filtered = [p for p in players if p.get("age", 99) > 0 and p.get("age", 99) < 23]
            filtered.sort(key=lambda p: p["rating"], reverse=True)
            _display_search_results(filtered[:20], "Jovenes destacados (< 23)", "rating")
        elif idx == 5:
            _custom_filter(teams)


def _search_by_name(teams):
    """Search for a player by name across all teams."""
    # Get all players (including those without stats)
    all_p = []
    for team_data in teams.values():
        for p in team_data["players"]:
            all_p.append(p)

    player_entries = [
        f"{p['position']:<4} {p['name']:<25} {p.get('team', '')[:18]:<18}"
        + (f" {p['rating']:.2f}" if p["appearances"] > 0 else "  -")
        for p in sorted(all_p, key=lambda x: x["name"])
    ]
    player_entries.append("<- Back")

    title = "\n  Buscar jugador (escribe para filtrar)\n"
    menu = TerminalMenu(
        player_entries,
        title=title,
        menu_cursor_style=("fg_cyan", "bold"),
        menu_highlight_style=("bg_cyan", "fg_black"),
        search_key=None,  # Enable live search with any key
    )
    idx = menu.show()

    if idx is None or idx == len(player_entries) - 1:
        return

    sorted_players = sorted(all_p, key=lambda x: x["name"])
    display_player_stats(sorted_players[idx])
    _wait()


def _custom_filter(teams):
    """Custom filter: select position, min stat, sort by."""
    players = _all_players(teams)

    # Select position
    pos_entries = ["Todas", "GK", "DEF", "MID", "FWD", "<- Back"]
    menu = TerminalMenu(pos_entries, title="\n  Posicion:\n",
                        menu_cursor_style=("fg_cyan", "bold"),
                        menu_highlight_style=("bg_cyan", "fg_black"))
    pos_idx = menu.show()
    if pos_idx is None or pos_idx == len(pos_entries) - 1:
        return

    if pos_idx > 0:
        pos = pos_entries[pos_idx]
        players = [p for p in players if p["position"] == pos]

    # Select sort criteria
    sort_options = [
        ("Rating", "rating"),
        ("Goles", "goals"),
        ("Asistencias", "assists"),
        ("xG", "xg"),
        ("Pases Clave", "key_passes"),
        ("Tackles", "tackles"),
        ("Intercepciones", "interceptions"),
        ("Despejes", "clearances"),
        ("Duelos Terrestres %", "ground_duels_won_pct"),
        ("Regates %", "dribbles_pct"),
        ("<- Back", None),
    ]
    sort_entries = [s[0] for s in sort_options]
    menu = TerminalMenu(sort_entries, title="\n  Ordenar por:\n",
                        menu_cursor_style=("fg_cyan", "bold"),
                        menu_highlight_style=("bg_cyan", "fg_black"))
    sort_idx = menu.show()
    if sort_idx is None or sort_options[sort_idx][1] is None:
        return

    sort_key = sort_options[sort_idx][1]
    players.sort(key=lambda p: p.get(sort_key, 0), reverse=True)

    _display_search_results(players[:20], f"Top por {sort_options[sort_idx][0]}", sort_key)


def _display_search_results(players, title, highlight_key):
    """Display a list of filtered players."""
    if not players:
        print("\n  No se encontraron jugadores.\n")
        _wait()
        return

    print(f"\n  {'─' * 65}")
    print(f"  {title}")
    print(f"  {'─' * 65}")
    print(f"  {'#':<3} {'Pos':<4} {'Jugador':<25} {'Equipo':<20} {'Rat':>4} {highlight_key[:6]:>6}")
    print(f"  {'─' * 65}")

    for i, p in enumerate(players[:20], 1):
        val = p.get(highlight_key, 0)
        if isinstance(val, float):
            val_str = f"{val:.2f}"
        else:
            val_str = str(val)
        print(f"  {i:<3} {p['position']:<4} {p['name']:<25} {p.get('team', '')[:18]:<20} {p['rating']:>4.1f} {val_str:>6}")

    print()
    _wait()


# ─── Teams Menu ───────────────────────────────────────────────


def player_list_menu(team_name, players):
    """Show players for a team and let user select one."""
    while True:
        entries = []
        for p in players:
            if p["appearances"] > 0:
                rating_str = f"{p['rating']:.2f}"
                goals_str = f"{p['goals']}G" if p["goals"] else ""
                assists_str = f"{p['assists']}A" if p["assists"] else ""
                ga = " ".join(filter(None, [goals_str, assists_str]))
                ga_display = f"  {ga}" if ga else ""
                entries.append(
                    f"{p['position']:<4} {p['name']:<25} {rating_str:>5}{ga_display}"
                )
            else:
                entries.append(
                    f"{p['position']:<4} {p['name']:<25}   -  "
                )
        entries.append("<- Back")

        played = sum(1 for p in players if p["appearances"] > 0)
        title = f"\n  {team_name} - Plantel ({len(players)} jugadores, {played} con stats)\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        display_player_stats(players[idx])
        _wait()


def teams_menu(teams):
    """Show team list and let user select one."""
    while True:
        entries = []
        team_names = list(teams.keys())

        for name in team_names:
            team_data = teams[name]
            info = team_data.get("info", {})
            players = team_data["players"]
            squad_size = len(players)
            total_goals = sum(p["goals"] for p in players)
            pts = info.get("points", 0)
            pos = info.get("position", "")
            record = f"{info.get('wins', 0)}W {info.get('draws', 0)}D {info.get('losses', 0)}L"

            entries.append(
                f"{pos:>2}. {name:<28} {pts:>2}pts  {record}  "
                f"{squad_size:>2} jug  {total_goals}G"
            )
        entries.append("<- Back")

        title = "\n  Liga DIMAYOR 2026 - Equipos\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == len(entries) - 1:
            return

        selected_team = team_names[idx]
        player_list_menu(selected_team, teams[selected_team]["players"])


# ─── Main Menu ────────────────────────────────────────────────


def main_menu(teams):
    """Main application menu."""
    while True:
        entries = [
            "Equipos y Planteles",
            "Rankings (Lideres por categoria)",
            "Comparar Jugadores",
            "Analisis Tactico (por equipo)",
            "Analisis de Liga",
            "Buscar / Filtrar Jugadores",
            "Salir",
        ]

        title = "\n  Liga DIMAYOR 2026 - Menu Principal\n"
        menu = TerminalMenu(
            entries,
            title=title,
            menu_cursor_style=("fg_cyan", "bold"),
            menu_highlight_style=("bg_cyan", "fg_black"),
        )
        idx = menu.show()

        if idx is None or idx == 6:
            print("  Hasta luego!")
            return

        if idx == 0:
            teams_menu(teams)
        elif idx == 1:
            rankings_menu(teams)
        elif idx == 2:
            comparison_menu(teams)
        elif idx == 3:
            tactical_menu(teams)
        elif idx == 4:
            league_analysis_menu(teams)
        elif idx == 5:
            search_menu(teams)


def main():
    force_update = "--update" in sys.argv

    teams = None

    if not force_update:
        teams = load_cache()

    if teams is None:
        session = create_session()
        teams = scrape_all(session)
        if not teams:
            print("Failed to load data. Try again later.")
            sys.exit(1)
        save_cache(teams)

    main_menu(teams)


if __name__ == "__main__":
    main()

// Sistema de pontuação e estatísticas (placar, pontos por quarto, box score).
export class ScoreSystem {
  constructor(world) {
    this.world = world;
    this.score = [0, 0];
    this.byQuarter = [[], []];
  }

  addPoints(team, points, quarter, shotInfo) {
    this.score[team] += points;
    const q = this.byQuarter[team];
    q[quarter - 1] = (q[quarter - 1] || 0) + points;
    if (shotInfo && shotInfo.shooter) {
      const s = shotInfo.shooter.stats;
      s.pts += points;
      if (shotInfo.type === 'ft') s.ftm++;
      else {
        s.fgm++;
        if (shotInfo.points === 3) s.tpm++;
        if (shotInfo.assistFrom && shotInfo.assistFrom.team === team) shotInfo.assistFrom.stats.ast++;
      }
    }
  }

  shotAttempt(info) {
    const s = info.shooter.stats;
    if (info.type === 'ft') s.fta++;
    else {
      s.fga++;
      if (info.points === 3) s.tpa++;
    }
  }

  teamTotals(team) {
    const t = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0 };
    for (const p of this.world.teams[team].players) for (const k in t) t[k] += p.stats[k];
    return t;
  }
}

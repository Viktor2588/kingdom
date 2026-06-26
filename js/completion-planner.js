/* ============================================================
   completion-planner.js — zielgerichteter 100%-Autopilot.
   DOM-frei; erweitert den bestehenden Zuschauer-Modus, ohne die
   allgemeine Greedy-Logik in systems.js zu duplizieren.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  if (!root.GameSystems || !root.GameAchievements) {
    throw new Error('completion-planner.js muss nach systems*.js und achievements.js geladen werden');
  }

  function GD() { return root.GameData; }
  function SYS() { return root.GameSystems; }
  function ACH() { return root.GameAchievements; }

  function ensure(state) {
    if (!state.completion || typeof state.completion !== 'object' || Array.isArray(state.completion)) {
      state.completion = {};
    }
    if (typeof state.completion.enabled !== 'boolean') state.completion.enabled = false;
    if (['all', 'achievements', 'bestiary'].indexOf(state.completion.target) < 0) state.completion.target = 'all';
    if (typeof state.completion.lastProgressTick !== 'number') state.completion.lastProgressTick = state.tick || 0;
    if (typeof state.completion.lastSignature !== 'string') state.completion.lastSignature = '';
    if (state.completion.diagnostic != null && typeof state.completion.diagnostic !== 'string') state.completion.diagnostic = null;
    return state.completion;
  }

  function targetIncludes(state, kind) {
    var target = ensure(state).target;
    return target === 'all' || target === kind;
  }

  function countTalents(state) {
    var total = 0, talents = (state.herrscher && state.herrscher.talents) || {};
    for (var id in talents) total += Math.max(0, Number(talents[id]) || 0);
    return total;
  }

  function snapshot(state) {
    var achievementsDone = ACH().unlockedCount(state);
    var speciesDone = GD().creatures.filter(function (sp) {
      return (state.seenSpecies || []).indexOf(sp.id) >= 0;
    }).length;
    return {
      achievements: { done: achievementsDone, total: ACH().total() },
      bestiary: { done: speciesDone, total: GD().creatures.length },
      regions: { done: (state.claimedRegions || []).length, total: GD().regions.length },
      recipes: { done: (state.unlockedRecipes || []).length, total: GD().recipes.length },
      talents: { done: countTalents(state), total: SYS().talentPointsEarned(state) }
    };
  }

  function progressSignature(state) {
    var snap = snapshot(state), achievementScore = 0;
    if (targetIncludes(state, 'achievements')) {
      ACH().ACHIEVEMENTS.forEach(function (achievement) {
        achievementScore += ACH().progressOf(state, achievement).frac;
      });
    }
    var maxCreatureLevel = 0;
    (state.creatures || []).forEach(function (creature) {
      maxCreatureLevel = Math.max(maxCreatureLevel, Number(creature.level) || 0);
    });
    return [
      targetIncludes(state, 'achievements') ? snap.achievements.done : '-',
      targetIncludes(state, 'achievements') ? Math.floor(achievementScore * 1000) : '-',
      targetIncludes(state, 'bestiary') ? snap.bestiary.done : '-',
      snap.regions.done,
      snap.recipes.done,
      snap.talents.done,
      state.herrscher ? state.herrscher.stage : 0,
      state.herrscher ? state.herrscher.level : 0,
      maxCreatureLevel
    ].join('|');
  }

  var pathsBySpecies = null;
  function buildSpeciesPaths() {
    if (pathsBySpecies) return pathsBySpecies;
    pathsBySpecies = {};
    var roots = GD().creatures.filter(function (sp) { return !!sp.summon; });
    function visit(id, path) {
      if (path.indexOf(id) >= 0) return;
      var nextPath = path.concat(id), sp = GD().creature(id);
      if (!pathsBySpecies[id]) pathsBySpecies[id] = [];
      if (!pathsBySpecies[id].some(function (saved) { return saved.join('|') === nextPath.join('|'); })) {
        pathsBySpecies[id].push(nextPath);
      }
      (sp && sp.evolvesTo || []).forEach(function (evolution) {
        visit(evolution.to, nextPath);
      });
    }
    roots.forEach(function (sp) { visit(sp.id, []); });
    return pathsBySpecies;
  }

  function descendants(id, seen) {
    seen = seen || {};
    if (seen[id]) return [];
    seen[id] = true;
    var sp = GD().creature(id), result = [id];
    (sp && sp.evolvesTo || []).forEach(function (evolution) {
      result = result.concat(descendants(evolution.to, seen));
    });
    return result.filter(function (value, index, all) { return all.indexOf(value) === index; });
  }

  function allDescendantsSeen(state, speciesId) {
    return descendants(speciesId).every(function (id) {
      return (state.seenSpecies || []).indexOf(id) >= 0;
    });
  }

  function temporarilyBusy(state, uid) {
    var expeditionBusy = (state.expeditions || []).some(function (expedition) {
      return (expedition.creatureUids || []).indexOf(uid) >= 0;
    });
    if (expeditionBusy) return true;
    return !!(state.activeCombat && state.activeCombat.status === 'active'
      && (state.activeCombat.party || []).some(function (actor) { return actor.key === uid; }));
  }

  function freeNameSlotPlan(state) {
    if (!SYS().featureUnlocked(state, 'fusion')) return null;
    var leaders = {};
    (state.armyGroups || []).forEach(function (group) {
      if (group.leaderUid != null) leaders[group.leaderUid] = true;
    });
    var named = (state.creatures || []).filter(function (creature) {
      return creature.named && !SYS().creatureBusy(state, creature.uid);
    });
    var catalysts = named.filter(function (creature) {
      return !leaders[creature.uid] && allDescendantsSeen(state, creature.speciesId)
        && (!achievementOpen(state, 'k_level100') || SYS().creatureLevelCap(creature) < 100);
    }).sort(function (a, b) {
      return SYS().creaturePower(state, a) - SYS().creaturePower(state, b);
    });
    for (var ci = 0; ci < catalysts.length; ci++) {
      for (var bi = 0; bi < named.length; bi++) {
        if (named[bi].uid === catalysts[ci].uid) continue;
        if ((named[bi].fusionLevel || 0) >= SYS().FUSION_MAX) continue;
        if (SYS().canFuse(state, named[bi].uid, catalysts[ci].uid).ok) {
          return {
            kind: 'fusion',
            executable: true,
            baseUid: named[bi].uid,
            catalystUid: catalysts[ci].uid,
            title: 'Namensslot für das Bestiarium freimachen'
          };
        }
      }
    }
    return null;
  }

  function candidateForPath(state, target, path) {
    var heldTarget = (state.creatures || []).filter(function (creature) {
      return creature.speciesId === target.id;
    })[0];
    if (heldTarget) {
      return { kind: 'record', executable: true, target: target, path: path, priority: 0 };
    }

    var best = null, bestIndex = -1, waiting = null, waitingIndex = -1;
    (state.creatures || []).forEach(function (creature) {
      var index = path.indexOf(creature.speciesId);
      if (temporarilyBusy(state, creature.uid)) {
        if (index > waitingIndex && index < path.length - 1) {
          waiting = creature; waitingIndex = index;
        }
        return;
      }
      if (SYS().creatureBusy(state, creature.uid)) return;
      if (index > bestIndex && index < path.length - 1) {
        best = creature; bestIndex = index;
      }
    });

    if (best) {
      if (!best.named) {
        var canName = SYS().canName(state, best);
        if (canName.ok) {
          return { kind: 'name', executable: true, creature: best, target: target, path: path, priority: 2 };
        }
        var slot = freeNameSlotPlan(state);
        if (slot) {
          slot.target = target; slot.path = path; slot.priority = 3;
          return slot;
        }
        return {
          kind: 'blocked', executable: false, target: target, path: path, priority: 9,
          reason: canName.reason || 'Namensgebung blockiert'
        };
      }
      var nextId = path[bestIndex + 1];
      var option = SYS().evolveOptions(state, best).filter(function (entry) { return entry.to === nextId; })[0];
      if (option && option.ok) {
        return {
          kind: 'evolve', executable: true, creature: best, nextId: nextId,
          target: target, path: path, priority: 1
        };
      }
      if (option && option.req && option.req.level && best.level < option.req.level && best.job !== 'armee') {
        return {
          kind: 'train', executable: true, creature: best, nextId: nextId,
          target: target, path: path, priority: 3
        };
      }
      return {
        kind: 'blocked', executable: false, target: target, path: path, priority: 8,
        reason: option && option.missing && option.missing.length ? option.missing.join(', ') : 'Evolution noch nicht möglich'
      };
    }

    if (waiting) {
      return {
        kind: 'blocked', executable: false, target: target, path: path, priority: 7,
        reason: (waiting.named ? waiting.name : GD().creature(waiting.speciesId).name) + ' ist noch auf Expedition'
      };
    }

    var rootSpecies = GD().creature(path[0]);
    if (!rootSpecies) return null;
    var summonCheck = SYS().canSummon(state, rootSpecies.id);
    if (summonCheck.ok) {
      return { kind: 'summon', executable: true, species: rootSpecies, target: target, path: path, priority: 4 };
    }
    if (SYS().usedCapacity(state) >= SYS().capacity(state) && SYS().canBuild(state, 'wohnbezirk')) {
      return { kind: 'build', buildingId: 'wohnbezirk', executable: true, target: target, path: path, priority: 5 };
    }
    var summonable = SYS().summonableSpecies(state).some(function (sp) { return sp.id === rootSpecies.id; });
    if (!summonable && SYS().canBuild(state, 'beschwoerungskreis')) {
      return { kind: 'build', buildingId: 'beschwoerungskreis', executable: true, target: target, path: path, priority: 5 };
    }
    return {
      kind: 'blocked', executable: false, target: target, path: path, priority: 10,
      reason: summonCheck.reason || 'Grundform noch nicht beschwörbar'
    };
  }

  function bestiaryPlan(state) {
    if (!targetIncludes(state, 'bestiary')) return null;
    var paths = buildSpeciesPaths(), candidates = [];
    GD().creatures.forEach(function (target, dataIndex) {
      if ((state.seenSpecies || []).indexOf(target.id) >= 0) return;
      (paths[target.id] || []).forEach(function (path) {
        var candidate = candidateForPath(state, target, path);
        if (candidate) {
          candidate.dataIndex = dataIndex;
          candidate.depth = path.length;
          candidates.push(candidate);
        }
      });
    });
    candidates.sort(function (a, b) {
      return Number(!a.executable) - Number(!b.executable)
        || a.priority - b.priority
        || a.depth - b.depth
        || a.dataIndex - b.dataIndex;
    });
    return candidates[0] || null;
  }

  function performBestiaryPlan(state, plan) {
    var result = null, targetName = plan.target ? plan.target.name : 'Bestiarium';
    if (plan.kind === 'record') {
      SYS().recordSeenSpecies(state);
      result = { text: '📖 ' + targetName + ' im Bestiarium erfasst.' };
    } else if (plan.kind === 'name') {
      var named = SYS().nameCreature(state, plan.creature.uid, null, null);
      if (named.ok) result = { text: '✨ ' + named.creature.name + ' für die Linie ' + targetName + ' benannt.' };
    } else if (plan.kind === 'evolve') {
      var evolved = SYS().evolve(state, plan.creature.uid, plan.nextId);
      if (evolved.ok) result = { text: '🧬 Ziel-Evolution: ' + GD().creature(plan.nextId).name + '.' };
    } else if (plan.kind === 'train') {
      var assigned = SYS().assignJob(state, plan.creature.uid, 'armee');
      if (assigned.ok) result = { text: '⚔️ ' + plan.creature.name + ' trainiert für die Evolution zu ' + GD().creature(plan.nextId).name + '.' };
    } else if (plan.kind === 'summon') {
      var summoned = SYS().summon(state, plan.species.id);
      if (summoned.ok) result = { text: '✨ Grundform ' + plan.species.name + ' für ' + targetName + ' beschworen.' };
    } else if (plan.kind === 'build') {
      var built = SYS().build(state, plan.buildingId);
      if (built.ok) result = { text: GD().building(plan.buildingId).icon + ' Voraussetzung für ' + targetName + ' ausgebaut.' };
    } else if (plan.kind === 'fusion') {
      var fused = SYS().fuse(state, plan.baseUid, plan.catalystUid);
      if (fused.ok) result = { text: '🧬 Vollständig erforschte Elite fusioniert; Namensslot für ' + targetName + ' frei.' };
    }
    if (result) result.goal = { kind: 'bestiary', id: plan.target.id, title: targetName };
    return result;
  }

  function tacticalGoalOpen(state) {
    var achievement = ACH().get('c_tactical10');
    return targetIncludes(state, 'achievements') && achievement && !ACH().isUnlocked(state, achievement.id);
  }

  function tacticalPlan(state) {
    if (!tacticalGoalOpen(state) || !SYS().startCombat) return null;
    if (state.activeCombat) {
      if (state.activeCombat.status !== 'active') return { kind: 'closeCombat', executable: true };
      return { kind: 'combatAction', executable: true };
    }
    if ((state.tick || 0) % 6 !== 0) return null;
    var region = SYS().visibleRegions(state).filter(function (entry) {
      return SYS().regionUnlocked(state, entry.id);
    }).sort(function (a, b) { return a.power - b.power; })[0];
    if (!region) return null;
    var party = SYS().armyAvailable(state).slice().sort(function (a, b) {
      return SYS().creaturePower(state, b) - SYS().creaturePower(state, a);
    }).slice(0, 3);
    var uids = party.map(function (creature) { return creature.uid; });
    if (SYS().expeditionPower(state, uids, true) < region.power) return null;
    var check = SYS().canStartCombat(state, region.id, uids, true);
    return check.ok
      ? { kind: 'startCombat', executable: true, region: region, uids: uids }
      : { kind: 'blocked', executable: false, reason: check.reason };
  }

  function performTacticalPlan(state, plan) {
    var combat = state.activeCombat, result;
    if (plan.kind === 'startCombat') {
      result = SYS().startCombat(state, plan.region.id, plan.uids, true, 'sicher');
      if (result.ok) return {
        text: '♟️ Taktik-Training in ' + plan.region.name + ' für den Erfolg „Taktiker".',
        goal: { kind: 'achievement', id: 'c_tactical10', title: 'Taktiker' }
      };
      return null;
    }
    if (plan.kind === 'closeCombat') {
      var won = combat && combat.status === 'victory';
      SYS().closeCombat(state);
      return {
        text: won ? '🏆 Taktik-Sieg ausgewertet.' : '♟️ Taktik-Training beendet.',
        goal: { kind: 'achievement', id: 'c_tactical10', title: 'Taktiker' }
      };
    }
    if (!combat || combat.status !== 'active') return null;
    var actor = SYS().battleCurrentActor(combat);
    if (!actor || actor.side !== 'party') return null;
    var enemies = combat.enemies || [], targetIndex = -1;
    for (var ei = 0; ei < enemies.length; ei++) {
      if (!enemies[ei].dead && enemies[ei].hp > 0) { targetIndex = ei; break; }
    }
    if (targetIndex < 0) return null;
    var abilities = SYS().combatAbilitiesFor(state, actor.key).map(function (id) {
      var ability = GD().battleAbility(id);
      return ability ? { id: id, ability: ability } : null;
    }).filter(function (ability) {
      return ability && ability.ability.kind !== 'guard' && ability.ability.kind !== 'heal'
        && ability.ability.kind !== 'analyze' && actor.mp >= ability.ability.cost;
    }).sort(function (a, b) { return (b.ability.power || 0) - (a.ability.power || 0); });
    var selected = abilities[0] || { id: 'angriff', ability: GD().battleAbility('angriff') };
    var acted = SYS().battleAction(state, selected.id, targetIndex);
    if (!acted.ok) acted = SYS().battleWait(state);
    if (!acted.ok) return null;
    return {
      text: selected.ability.icon + ' Automatischer Taktikzug für „Taktiker".',
      goal: { kind: 'achievement', id: 'c_tactical10', title: 'Taktiker' }
    };
  }

  function siegeAchievementPlan(state) {
    if (!achievementOpen(state, 'c_rivals') || !SYS().startSiege || !SYS().siegeAction) return null;
    if (state.siege && state.siege.active) {
      return { kind: 'siegeAction', executable: true, achievementId: 'c_rivals', title: 'Bezwinger der Lords' };
    }
    if (state.raid) {
      var ticksLeft = Math.max(0, state.raid.atTick - state.tick);
      if (ticksLeft > 1 && SYS().defenseValue(state) < state.raid.power) {
        var defender = (state.creatures || []).filter(function (creature) {
          return creature.job !== 'armee' && !temporarilyBusy(state, creature.uid)
            && !SYS().creatureBusy(state, creature.uid) && !SYS().isWounded(state, creature);
        }).sort(function (a, b) {
          return SYS().creaturePower(state, b) - SYS().creaturePower(state, a);
        })[0];
        if (defender) {
          return {
            kind: 'prepareSiege',
            executable: true,
            creature: defender,
            achievementId: 'c_rivals',
            title: 'Bezwinger der Lords'
          };
        }
        if (SYS().canBuild(state, 'labyrinth')) {
          return {
            kind: 'achievementBuild',
            buildingId: 'labyrinth',
            executable: true,
            achievementId: 'c_rivals',
            title: 'Bezwinger der Lords'
          };
        }
      }
      return { kind: 'startSiege', executable: true, achievementId: 'c_rivals', title: 'Bezwinger der Lords' };
    }
    return null;
  }

  function achievementOpen(state, id) {
    return targetIncludes(state, 'achievements') && !ACH().isUnlocked(state, id);
  }

  function cheapestSummon(state) {
    return SYS().summonableSpecies(state).slice().sort(function (a, b) {
      var ac = SYS().summonCost(state, a.id) || {}, bc = SYS().summonCost(state, b.id) || {};
      var at = 0, bt = 0, key;
      for (key in ac) at += ac[key];
      for (key in bc) bt += bc[key];
      return at - bt || a.power - b.power;
    })[0] || null;
  }

  function capacityReliefPlan(state) {
    if (SYS().usedCapacity(state) < SYS().capacity(state)) return null;
    if (SYS().canBuild(state, 'wohnbezirk')) {
      return { kind: 'achievementBuild', buildingId: 'wohnbezirk', executable: true };
    }
    var groups = (state.armyGroups || []).slice().sort(function (a, b) {
      return Number(!a.rulerLed) - Number(!b.rulerLed);
    });
    for (var gi = 0; gi < groups.length; gi++) {
      var speciesIds = Object.keys(groups[gi].troops || {}).filter(function (id) {
        return groups[gi].troops[id] > 0;
      }).sort(function (a, b) {
        return groups[gi].troops[b] - groups[gi].troops[a];
      });
      if (speciesIds.length) {
        return {
          kind: 'dismissTroops',
          executable: true,
          groupId: groups[gi].id,
          speciesId: speciesIds[0],
          amount: Math.max(1, SYS().usedCapacity(state) - SYS().capacity(state) + 1)
        };
      }
    }
    return null;
  }

  function summonAchievementPlan(state) {
    if (!achievementOpen(state, 'k_summon25') || (state.metrics.summoned || 0) >= 25) return null;
    var species = cheapestSummon(state);
    if (species && SYS().canSummon(state, species.id).ok) {
      return { kind: 'achievementSummon', executable: true, species: species, achievementId: 'k_summon25', title: 'Heerführer' };
    }
    var relief = capacityReliefPlan(state);
    if (relief) {
      relief.achievementId = 'k_summon25';
      relief.title = 'Heerführer';
      return relief;
    }
    if (SYS().canBuild(state, 'beschwoerungskreis')) {
      return { kind: 'achievementBuild', buildingId: 'beschwoerungskreis', executable: true, achievementId: 'k_summon25', title: 'Heerführer' };
    }
    return null;
  }

  function namedAchievementPlan(state) {
    if (!achievementOpen(state, 'k_named20') || SYS().namedCount(state) >= 20) return null;
    if (SYS().nameCapacity(state) <= SYS().namedCount(state)) {
      if (SYS().canBuild(state, 'seelentempel')) {
        return { kind: 'achievementBuild', buildingId: 'seelentempel', executable: true, achievementId: 'k_named20', title: 'Volle Tafel' };
      }
      if (SYS().canBuild(state, 'magieturm')) {
        return { kind: 'achievementBuild', buildingId: 'magieturm', executable: true, achievementId: 'k_named20', title: 'Volle Tafel' };
      }
      return null;
    }
    var unnamed = (state.creatures || []).filter(function (creature) {
      return !creature.named && !temporarilyBusy(state, creature.uid) && !SYS().creatureBusy(state, creature.uid);
    }).sort(function (a, b) {
      var ac = SYS().nameCost(state, a), bc = SYS().nameCost(state, b);
      var at = 0, bt = 0, key;
      for (key in ac) at += ac[key];
      for (key in bc) bt += bc[key];
      return at - bt;
    });
    for (var ui = 0; ui < unnamed.length; ui++) {
      if (SYS().canName(state, unnamed[ui]).ok) {
        return {
          kind: 'achievementName',
          executable: true,
          creature: unnamed[ui],
          achievementId: 'k_named20',
          title: 'Volle Tafel'
        };
      }
    }
    if (unnamed.length) {
      if ((state.seenSpecies || []).length < GD().creatures.length) return null;
      var magicWorker = (state.creatures || []).filter(function (creature) {
        return creature.job !== 'magie' && !temporarilyBusy(state, creature.uid)
          && !SYS().creatureBusy(state, creature.uid);
      }).sort(function (a, b) { return (b.count || 1) - (a.count || 1); })[0];
      if (magicWorker) {
        return {
          kind: 'assignMagic',
          executable: true,
          creature: magicWorker,
          achievementId: 'k_named20',
          title: 'Volle Tafel'
        };
      }
      return null;
    }
    var species = cheapestSummon(state);
    if (species && SYS().canSummon(state, species.id).ok) {
      return { kind: 'achievementSummon', executable: true, species: species, achievementId: 'k_named20', title: 'Volle Tafel' };
    }
    var relief = capacityReliefPlan(state);
    if (relief) {
      relief.achievementId = 'k_named20';
      relief.title = 'Volle Tafel';
      return relief;
    }
    return null;
  }

  function levelAchievementPlan(state) {
    if (!achievementOpen(state, 'k_level100')) return null;
    var candidates = (state.creatures || []).filter(function (creature) {
      return creature.named && SYS().creatureLevelCap(creature) >= 100;
    }).sort(function (a, b) { return b.level - a.level; });
    for (var ci = 0; ci < candidates.length; ci++) {
      if (temporarilyBusy(state, candidates[ci].uid) || SYS().creatureBusy(state, candidates[ci].uid)) continue;
      if (candidates[ci].job !== 'armee') {
        return {
          kind: 'assignTraining',
          executable: true,
          creature: candidates[ci],
          achievementId: 'k_level100',
          title: 'Vollendet'
        };
      }
      return null;
    }
    if (ACH().isUnlocked(state, 'c_army10')) {
      for (var gi = 0; gi < (state.armyGroups || []).length; gi++) {
        var group = state.armyGroups[gi];
        if (group.rulerLed) continue;
        var leader = SYS().findCreature(state, group.leaderUid);
        if (leader && SYS().creatureLevelCap(leader) >= 100) {
          return {
            kind: 'disbandTrainingArmy',
            executable: true,
            group: group,
            achievementId: 'k_level100',
            title: 'Vollendet'
          };
        }
      }
    }
    return null;
  }

  function armyAchievementPlan(state) {
    if (!achievementOpen(state, 'c_army10') || (state.metrics.armyVictories || 0) >= 10) return null;
    var groups = (state.armyGroups || []).filter(function (group) {
      return !group.rulerLed && !!SYS().findCreature(state, group.leaderUid);
    });
    if (!groups.length) {
      var leaders = SYS().eligibleArmyLeaders(state);
      if (leaders.length && SYS().canCreateArmyGroup(state, leaders[0].uid).ok) {
        return { kind: 'createArmy', executable: true, leaderUid: leaders[0].uid, achievementId: 'c_army10', title: 'Kriegsherr' };
      }
      return null;
    }
    groups.sort(function (a, b) { return SYS().armyGroupPower(state, b) - SYS().armyGroupPower(state, a); });
    var group = groups[0], currentRegion = GD().region(group.position);
    if (currentRegion && SYS().armyGroupPower(state, group) >= currentRegion.power) {
      return { kind: 'armyAttack', executable: true, group: group, region: currentRegion, achievementId: 'c_army10', title: 'Kriegsherr' };
    }
    var regions = GD().regions.filter(function (region) {
      return (state.claimedRegions || []).indexOf(region.id) >= 0 && SYS().regionUnlocked(state, region.id);
    }).sort(function (a, b) { return a.power - b.power; });
    if (!regions.length) return null;
    var route = SYS().strategicPath(state, group.position, regions[0].id);
    if (route.length > 1 && SYS().canMoveArmyGroup(state, group.id, route[1]).ok) {
      return { kind: 'moveArmy', executable: true, group: group, nodeId: route[1], achievementId: 'c_army10', title: 'Kriegsherr' };
    }
    return null;
  }

  function rivalAchievementPlan(state) {
    if (!achievementOpen(state, 'c_rivals')) return null;
    var rivals = GD().rivals.filter(function (rival) {
      return SYS().canCounterAttack(state, rival.id).ok;
    });
    if (!rivals.length) return null;
    var uids = (state.creatures || []).filter(function (creature) {
      return !SYS().creatureBusy(state, creature.uid) && !SYS().isWounded(state, creature);
    }).map(function (creature) { return creature.uid; });
    var power = uids.reduce(function (total, uid) {
      return total + SYS().creaturePower(state, SYS().findCreature(state, uid));
    }, 0) + SYS().rulerPower(state);
    power = Math.round(power * (1 + (SYS().computeBonuses(state).armee || 0)));
    rivals.sort(function (a, b) { return SYS().rivalLairPower(state, a.id) - SYS().rivalLairPower(state, b.id); });
    if (power < SYS().rivalLairPower(state, rivals[0].id)) return null;
    return { kind: 'counterRival', executable: true, rival: rivals[0], uids: uids, achievementId: 'c_rivals', title: 'Bezwinger der Lords' };
  }

  function echoAchievementPlan(state) {
    var needsBosses = achievementOpen(state, 'c_echoBoss3');
    var needsCycle = achievementOpen(state, 'c_echocycle5');
    if ((!needsBosses && !needsCycle) || !SYS().echoUnlocked(state)) return null;
    SYS().ensureEchoMap(state);
    if (SYS().echoBossCompleted(state)) {
      return { kind: 'advanceEcho', executable: true, achievementId: needsCycle ? 'c_echocycle5' : 'c_echoBoss3', title: needsCycle ? 'Tiefen-Wanderer' : 'Kern-Brecher' };
    }
    var nodes = SYS().availableEchoNodes(state).sort(function (a, b) { return a.power - b.power; });
    var groups = (state.armyGroups || []).filter(function (group) {
      return SYS().armyCommandUsed(group) > 0;
    }).sort(function (a, b) { return SYS().armyGroupPower(state, b) - SYS().armyGroupPower(state, a); });
    for (var ni = 0; ni < nodes.length; ni++) {
      for (var gi = 0; gi < groups.length; gi++) {
        var check = SYS().canChallengeEcho(state, groups[gi].id, nodes[ni].id);
        if (check.ok && check.power >= nodes[ni].power) {
          return {
            kind: 'challengeEcho',
            executable: true,
            group: groups[gi],
            node: nodes[ni],
            achievementId: needsBosses ? 'c_echoBoss3' : 'c_echocycle5',
            title: needsBosses ? 'Kern-Brecher' : 'Tiefen-Wanderer'
          };
        }
      }
    }
    return null;
  }

  function achievementPlan(state) {
    return summonAchievementPlan(state)
      || namedAchievementPlan(state)
      || armyAchievementPlan(state)
      || rivalAchievementPlan(state)
      || echoAchievementPlan(state)
      || levelAchievementPlan(state);
  }

  function performAchievementPlan(state, plan) {
    var result = null;
    if (plan.kind === 'achievementSummon') {
      var summoned = SYS().summon(state, plan.species.id);
      if (summoned.ok) result = { text: '✨ ' + plan.species.name + ' für „' + plan.title + '“ beschworen.' };
    } else if (plan.kind === 'achievementName') {
      var named = SYS().nameCreature(state, plan.creature.uid, null, null);
      if (named.ok) result = { text: '✨ ' + named.creature.name + ' für „' + plan.title + '“ benannt.' };
    } else if (plan.kind === 'assignMagic') {
      var assignedMagic = SYS().assignJob(state, plan.creature.uid, 'magie');
      if (assignedMagic.ok) result = { text: '🔮 Gefolge sammelt Magie für „' + plan.title + '“.' };
    } else if (plan.kind === 'assignTraining') {
      var assignedTraining = SYS().assignJob(state, plan.creature.uid, 'armee');
      if (assignedTraining.ok) result = { text: '⚔️ ' + plan.creature.name + ' trainiert für „' + plan.title + '“.' };
    } else if (plan.kind === 'prepareSiege') {
      var assignedDefense = SYS().assignJob(state, plan.creature.uid, 'armee');
      if (assignedDefense.ok) result = { text: '🛡️ Gefolge wird für die Rivalenabwehr mobilisiert.' };
    } else if (plan.kind === 'disbandTrainingArmy') {
      var disbanded = SYS().disbandArmyGroup(state, plan.group.id);
      if (disbanded.ok) result = { text: '🏳️ Elite aus ' + plan.group.name + ' für Leveltraining freigestellt.' };
    } else if (plan.kind === 'achievementBuild') {
      var built = SYS().build(state, plan.buildingId);
      if (built.ok) result = { text: GD().building(plan.buildingId).icon + ' Voraussetzung für „' + plan.title + '“ ausgebaut.' };
    } else if (plan.kind === 'dismissTroops') {
      var dismissed = SYS().dismissTroops(state, plan.groupId, plan.speciesId, plan.amount);
      if (dismissed.ok) result = { text: '🏳️ ' + dismissed.removed + ' Truppen für Completion-Kapazität entlassen.' };
    } else if (plan.kind === 'createArmy') {
      var created = SYS().createArmyGroup(state, plan.leaderUid);
      if (created.ok) result = { text: '🚩 ' + created.group.name + ' für „Kriegsherr“ aufgestellt.' };
    } else if (plan.kind === 'moveArmy') {
      var moved = SYS().moveArmyGroup(state, plan.group.id, plan.nodeId);
      if (moved.ok) result = { text: '🗺️ ' + plan.group.name + ' zieht zum Feldzug.' };
    } else if (plan.kind === 'armyAttack') {
      var attacked = SYS().attackWithArmyGroup(state, plan.group.id, 'sicher');
      if (attacked.ok && attacked.won) result = { text: '🏆 Feldzugssieg in ' + plan.region.name + ' für „Kriegsherr“.' };
    } else if (plan.kind === 'counterRival') {
      var countered = SYS().counterAttackRival(state, plan.rival.id, plan.uids);
      if (countered.ok && countered.won) result = { text: '👑 ' + plan.rival.name + ' endgültig besiegt.' };
    } else if (plan.kind === 'advanceEcho') {
      var advanced = SYS().advanceEchoCycle(state);
      if (advanced.ok) result = { text: '🌀 Echo-Zyklus ' + advanced.cycle + ' für „' + plan.title + '“ geöffnet.' };
    } else if (plan.kind === 'challengeEcho') {
      var challenged = SYS().challengeEcho(state, plan.group.id, plan.node.id, 'sicher');
      if (challenged.ok && challenged.won) result = { text: '🌀 ' + plan.node.name + ' für „' + plan.title + '“ bezwungen.' };
    } else if (plan.kind === 'startSiege') {
      var siege = SYS().startSiege(state);
      if (siege.ok) result = { text: '🏰 Aktive Verteidigung gegen ' + siege.rival.name + ' begonnen.' };
    } else if (plan.kind === 'siegeAction') {
      var defended = SYS().siegeAction(state, 'ausfall');
      if (defended.ok) result = { text: defended.finished ? '🏰 Belagerung entschieden.' : '⚔️ Ausfall gegen den belagernden Rivalen.' };
    }
    if (result) result.goal = { kind: 'achievement', id: plan.achievementId, title: plan.title };
    return result;
  }

  function achievementTarget(state) {
    if (!targetIncludes(state, 'achievements')) return null;
    var open = ACH().ACHIEVEMENTS.filter(function (achievement) {
      return !ACH().isUnlocked(state, achievement.id);
    }).map(function (achievement, index) {
      return { achievement: achievement, progress: ACH().progressOf(state, achievement), index: index };
    });
    open.sort(function (a, b) {
      return b.progress.frac - a.progress.frac || a.index - b.index;
    });
    return open.length ? {
      kind: 'achievement',
      id: open[0].achievement.id,
      title: open[0].achievement.title,
      progress: open[0].progress
    } : null;
  }

  function focus(state, bestiary) {
    if (bestiary && bestiary.target) {
      return {
        kind: 'bestiary',
        id: bestiary.target.id,
        title: bestiary.target.name,
        reason: bestiary.reason || null
      };
    }
    return achievementTarget(state);
  }

  function observeProgress(state, currentFocus) {
    var completion = ensure(state), signature = progressSignature(state);
    if (!currentFocus) {
      completion.lastSignature = signature;
      completion.lastProgressTick = state.tick || 0;
      completion.diagnostic = null;
      return;
    }
    if (signature !== completion.lastSignature) {
      completion.lastSignature = signature;
      completion.lastProgressTick = state.tick || 0;
      completion.diagnostic = null;
      return;
    }
    if ((state.tick || 0) - completion.lastProgressTick < 300) return;
    if (currentFocus && currentFocus.reason) {
      completion.diagnostic = currentFocus.title + ': ' + currentFocus.reason;
    } else if (currentFocus) {
      completion.diagnostic = currentFocus.title + ': seit 300 Ticks kein messbarer Fortschritt; Ressourcen, Kapazität und Voraussetzungen prüfen.';
    } else {
      completion.diagnostic = 'Kein offenes Completion-Ziel gefunden.';
    }
  }

  function step(state) {
    ensure(state);
    if (!state.completion.enabled) return SYS().autoPlayGreedyStep(state);

    var bestiary = bestiaryPlan(state);
    var currentFocus = focus(state, bestiary);
    observeProgress(state, currentFocus);

    var siege = siegeAchievementPlan(state);
    if (siege && siege.executable) {
      var siegeResult = performAchievementPlan(state, siege);
      if (siegeResult) return siegeResult;
    }

    var tactical = tacticalPlan(state);
    if (tactical && tactical.executable && (state.activeCombat || (state.tick || 0) % 6 === 0)) {
      var tacticalResult = performTacticalPlan(state, tactical);
      if (tacticalResult) return tacticalResult;
    }

    var urgentRival = rivalAchievementPlan(state);
    if (urgentRival && urgentRival.executable) {
      var rivalResult = performAchievementPlan(state, urgentRival);
      if (rivalResult) return rivalResult;
    }

    if (bestiary && bestiary.executable) {
      var bestiaryResult = performBestiaryPlan(state, bestiary);
      if (bestiaryResult) return bestiaryResult;
    }

    var achievement = achievementPlan(state);
    if (achievement && achievement.executable) {
      var achievementResult = performAchievementPlan(state, achievement);
      if (achievementResult) return achievementResult;
    }

    var fallback = SYS().autoPlayGreedyStep(state);
    if (fallback && currentFocus) {
      fallback.goal = { kind: currentFocus.kind, id: currentFocus.id, title: currentFocus.title };
      fallback.text += ' · Ziel: ' + currentFocus.title;
    }
    return fallback;
  }

  function status(state) {
    var bestiary = bestiaryPlan(state), currentFocus = focus(state, bestiary);
    observeProgress(state, currentFocus);
    return {
      enabled: !!ensure(state).enabled,
      target: ensure(state).target,
      progress: snapshot(state),
      focus: currentFocus,
      diagnostic: ensure(state).diagnostic
    };
  }

  root.GameCompletionPlanner = {
    ensure: ensure,
    snapshot: snapshot,
    status: status,
    bestiaryPlan: bestiaryPlan,
    pathsForSpecies: function (id) { return (buildSpeciesPaths()[id] || []).map(function (path) { return path.slice(); }); },
    step: step
  };
})();

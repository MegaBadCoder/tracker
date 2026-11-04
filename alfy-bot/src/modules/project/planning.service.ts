import { BadRequestException, Injectable } from '@nestjs/common';
import { PlanningRepositoryPort } from './domain/planning-repository.port';
import {
  PlanningMove,
  PlanningOrder,
  PlanningProposal,
} from './domain/planning';
import { planningContext } from './domain/planning-context';
import { proposePlan } from './domain/planning-proposal';

@Injectable()
export class PlanningService {
  constructor(private readonly repository: PlanningRepositoryPort) {}

  async context(userId: number, projectId: string, sprintId: string | null) {
    const data = await this.repository.load(userId, projectId);
    if (
      sprintId !== null &&
      !data.sprints.some((s) => s.id === sprintId && s.status !== 'closed')
    )
      throw new BadRequestException('Нужен незакрытый спринт проекта');
    return planningContext(data, sprintId);
  }

  async proposal(userId: number, projectId: string, input: PlanningProposal) {
    const data = await this.repository.load(userId, projectId);
    if (
      !data.sprints.some(
        (s) => s.id === input.sprintId && s.status !== 'closed',
      )
    )
      throw new BadRequestException('Нужен незакрытый спринт проекта');
    return proposePlan(data, input);
  }

  move(userId: number, projectId: string, input: PlanningMove) {
    return this.repository.move(userId, projectId, input);
  }
  undo(userId: number, projectId: string, token: string) {
    return this.repository.undo(userId, projectId, token);
  }
  reorder(userId: number, projectId: string, input: PlanningOrder) {
    return this.repository.reorder(userId, projectId, input);
  }

  async report(userId: number, projectId: string, sprintId: string) {
    const { sprint, current, events } = await this.repository.report(
      userId,
      projectId,
      sprintId,
    );
    const final =
      sprint.finalSnapshot ?? (sprint.status === 'active' ? current : null);
    return {
      sprint,
      historyComplete: Boolean(
        sprint.initialSnapshot &&
        (sprint.status !== 'closed' || sprint.finalSnapshot),
      ),
      initial: sprint.initialSnapshot,
      final: sprint.finalSnapshot,
      events,
      summary: {
        planned: sprint.initialSnapshot?.tasks.length ?? 0,
        added: events.filter((e) => e.kind === 'added').length,
        removed: events.filter((e) => e.kind === 'removed').length,
        completed: final?.tasks.filter((t) => t.completed).length ?? 0,
        carried:
          sprint.status === 'closed'
            ? (final?.tasks.filter((t) => !t.completed).length ?? 0)
            : 0,
      },
      retrospective: sprint.retrospective ?? {
        goalOutcome: null,
        retrospective: null,
        improvement: null,
        carryoverReason: null,
      },
    };
  }
}

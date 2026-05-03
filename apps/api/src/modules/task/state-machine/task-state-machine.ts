import { InvalidTaskTransitionException } from '../exceptions/invalid-transition.exception';
import { TaskStatus } from '../constants/task-status.enum';
import { TRANSITION_RULES } from './transition-rules';

export class TaskStateMachine {
  /**
   * 校验跃迁是否合法，不合法直接抛异常
   */
  static assertCanTransition(from: TaskStatus, to: TaskStatus): void {
    const allowed = TaskStateMachine.getAllowedTransitions(from);
    if (!allowed.includes(to)) {
      throw new InvalidTaskTransitionException(from, to, allowed);
    }
  }

  /**
   * 静默判断（不抛异常）
   */
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TaskStateMachine.getAllowedTransitions(from).includes(to);
  }

  /**
   * 获取某状态的所有合法目标状态
   */
  static getAllowedTransitions(from: TaskStatus): TaskStatus[] {
    return TRANSITION_RULES[from] ?? [];
  }

  /**
   * 是否为终态
   */
  static isTerminal(status: TaskStatus): boolean {
    return TaskStateMachine.getAllowedTransitions(status).length === 0;
  }
}

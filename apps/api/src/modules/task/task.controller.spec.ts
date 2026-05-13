import { TaskController } from './task.controller';
import type { QueryTaskDto } from './dto/query-task.dto';

describe('TaskController contract alignment', () => {
  const createTask = jest.fn();
  const bootstrapTask = jest.fn();
  const findList = jest.fn();

  const controller = new TaskController({
    createTask,
    bootstrapTask,
    findList,
  } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bootstrap delegates to service.bootstrapTask with user scope', async () => {
    bootstrapTask.mockResolvedValue({ id: 't1' });
    const dto = { title: '论文任务', major: '计算机' };

    const result = await controller.bootstrap('u1', dto);

    expect(bootstrapTask).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ id: 't1' });
  });

  it('myTasks delegates to service.findList with same query contract', async () => {
    const paged = { items: [{ id: 't1' }], total: 1, page: 1, pageSize: 10 };
    findList.mockResolvedValue(paged);
    const query: QueryTaskDto = {
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    const result = await controller.myTasks('u1', query);

    expect(findList).toHaveBeenCalledWith('u1', query);
    expect(result).toEqual(paged);
  });
});

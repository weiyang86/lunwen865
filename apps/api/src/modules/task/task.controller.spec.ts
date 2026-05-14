import { TaskController } from './task.controller';
import type { QueryTaskDto } from './dto/query-task.dto';
import type { BootstrapTaskDto } from './dto/bootstrap-task.dto';
import type { TaskService } from './task.service';

describe('TaskController contract alignment', () => {
  const createTask = jest.fn<
    ReturnType<TaskService['createTask']>,
    Parameters<TaskService['createTask']>
  >();
  const bootstrapTask = jest.fn<
    ReturnType<TaskService['bootstrapTask']>,
    Parameters<TaskService['bootstrapTask']>
  >();
  const findList = jest.fn<
    ReturnType<TaskService['findList']>,
    Parameters<TaskService['findList']>
  >();

  const taskService = {
    createTask,
    bootstrapTask,
    findList,
  } as unknown as TaskService;

  const controller = new TaskController(taskService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bootstrap delegates to service.bootstrapTask with user scope', async () => {
    bootstrapTask.mockResolvedValue({ id: 't1' } as unknown as Awaited<
      ReturnType<TaskService['bootstrapTask']>
    >);
    const dto: BootstrapTaskDto = { title: '论文任务', major: '计算机' };

    const result = await controller.bootstrap('u1', dto);

    expect(bootstrapTask).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ id: 't1' });
  });

  it('list delegates to service.findList with same query contract', async () => {
    const paged = {
      items: [{ id: 't1' }],
      total: 1,
      page: 1,
      pageSize: 10,
    } as unknown as Awaited<ReturnType<TaskService['findList']>>;
    findList.mockResolvedValue(paged);
    const query: QueryTaskDto = {
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    const result = await controller.list('u1', query);

    expect(findList).toHaveBeenCalledWith('u1', query);
    expect(result).toEqual(paged);
  });
});

import { Body, Controller, Get, Post, Query, Inject, Delete, Patch, Param } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { GetTasksQueryDto, RescoreTasksQueryDto, CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

@ApiTags("tasks")
// @ApiBearerAuth('bearer')  // Temporarily disabled for testing
// @UseGuards(SupabaseJwtGuard)  // Temporarily disabled for testing
@Controller("tasks")
export class TasksController {
  constructor(@Inject(TasksService) private readonly taskService: TasksService) {}

  @Get()
  @ApiQuery({ name: "project", required: false, description: "Filter by project name" })
  @ApiQuery({ name: "bucket", required: false, description: "Filter by priority buckets (P0,P1,P2,P3)" })
  @ApiQuery({ name: "status", required: false, enum: ["todo", "in_progress", "done"] })
  @ApiQuery({ name: "limit", required: false, description: "Limit number of results" })
  getTasks(@Query() query: GetTasksQueryDto) {
    return this.taskService.getTasks("seankonig", query);
  }

  @Post("rescore")
  @ApiQuery({ name: "project", required: false, description: "Rescore tasks for specific project" })
  rescoreTasks(@Query() query: RescoreTasksQueryDto) {
    return this.taskService.rescoreTasks("seankonig", query.project);
  }

  @Delete()
  @ApiQuery({ name: "project", required: false, description: "Delete tasks for specific project (by name). If omitted, deletes all tasks for the user." })
  deleteTasks(@Query("project") project?: string) {
    return this.taskService.deleteTasks("seankonig", project);
  }

  @Post()
  createTask(@Body() dto: CreateTaskDto) {
    return this.taskService.createTask("seankonig", dto);
  }

  @Patch(":id")
  updateTask(@Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.taskService.updateTask("seankonig", id, dto);
  }
}

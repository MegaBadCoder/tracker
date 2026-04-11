import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { CreateGoalScene } from './scenes/create-goal.scene';
import { EditGoalScene } from './scenes/edit-goal.scene';
import { ListGoalsScene } from './scenes/list-goals.scene';
import { ReportScene } from './scenes/report.scene';
import { AuthModule } from '../auth/auth.module';
import { GoalModule } from '../goal/goal.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [AuthModule, GoalModule, ReportModule],
  providers: [
    BotUpdate,
    CreateGoalScene,
    EditGoalScene,
    ListGoalsScene,
    ReportScene,
  ],
})
export class BotModule {}

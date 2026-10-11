import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTokenService } from './application/api-token.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@Controller('auth/api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokenService: ApiTokenService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Request() req: AuthRequest, @Body() dto: CreateApiTokenDto) {
    return this.apiTokenService.generate(req.user.sub, dto.name);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Request() req: AuthRequest) {
    return this.apiTokenService.list(req.user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  revoke(@Request() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    if (id < 1) throw new BadRequestException('Invalid token ID');
    return this.apiTokenService.revoke(id, req.user.sub);
  }
}

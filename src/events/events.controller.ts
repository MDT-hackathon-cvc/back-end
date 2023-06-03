import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Utils } from 'src/common/utils';
import { EventsService } from './events.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FindEventDto } from './dto/user/find-event';
import { ParseObjectIdPipe } from 'src/common/pipe/parse-objectid.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('events')
@ApiTags('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(@Request() req: Request, @Query() requestData: FindEventDto) {
    const user = await Utils.getUser(req);
    return this.eventsService.findAll(requestData, user);
  }

  @Get(':id')
  async findOne(
    @Request() req: Request,
    @Param('id', new ParseObjectIdPipe()) id: string,
  ) {
    const user = await Utils.getUser(req);
    return this.eventsService.findOne(id, user);
  }
}

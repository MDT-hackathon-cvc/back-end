import { Controller, Get, Header, Param } from '@nestjs/common';
import { TokensService } from './tokens.service';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('721/:id')
  @Header('content-type', 'application/json')
  async findBy721ByNftId(@Param('id') id: string) {
    return this.tokensService.findBy721ByNftId(id);
  }
}

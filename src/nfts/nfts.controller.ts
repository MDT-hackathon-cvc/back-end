import { FindTokensCanRedeemDto } from './dto/user/find-tokens-can-redeem.dto';
import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NftsService } from './nfts.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Utils } from 'src/common/utils';
import { FindTransactionDto } from './dto/user/find-transaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
// import { Role } from 'src/auth/role.enum';
import { FindItemOwnerDto } from './dto/user/find-item-owner.dto';
import { UserRole } from 'src/schemas/User.schema';
import { FindNftDto } from './dto/admin/find-nft.dto';

@ApiTags('nfts')
@Controller('nfts')
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get()
  async findAll(@Query() requestData: FindNftDto) {
    return this.nftsService.findAll(requestData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get('/tokens-can-redeem')
  async findListTokenCanRedeem(
    @Query() requestData: FindTokensCanRedeemDto,
    @Request() req,
  ) {
    return this.nftsService.findListTokenCanRedeem(
      req.user.address,
      requestData,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get('owner')
  async findOwnerNft(@Request() req) {
    return this.nftsService.findOwnerNft(req.user.address);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.nftsService.findNFTDetailUser(req.user.address, id);
  }

  @Get(':id/transactions')
  async findTransactions(
    @Request() req: Request,
    @Param('id') id: string,
    @Query() requestData: FindTransactionDto,
  ) {
    const user = await Utils.getUser(req);
    return this.nftsService.findTransactions(id, requestData, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @Get(':id/owned')
  async findOwned(
    @Request() req,
    @Param('id') id: string,
    @Query() requestData: FindItemOwnerDto,
  ) {
    return this.nftsService.findOwned(req.user, id, requestData);
  }
}

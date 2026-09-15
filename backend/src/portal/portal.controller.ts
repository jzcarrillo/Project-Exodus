import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { UserIdentity } from '../common/types';
import {
  PortalActionDto,
  SaveDraftDto,
  SubmitApplicationDto,
  UpdateProfileDto,
  ReviewActionDto,
} from './portal.dto';

@ApiTags('Portal & Applications')
@ApiBearerAuth()
@Controller('api/portal')
@UseGuards(AuthGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user applications, profile, documents, and notifications' })
  @ApiQuery({ name: 'application', required: false })
  @ApiQuery({ name: 'review', required: false })
  async getPortal(
    @CurrentUser() user: UserIdentity,
    @Query('application') application?: string,
    @Query('review') review?: string,
  ) {
    return this.portalService.getPortalData(user, application, review === '1');
  }

  @Post()
  @ApiOperation({ summary: 'Unified Portal Dispatcher for actions (save, submit, profile, read, review)' })
  async handlePortalAction(@CurrentUser() user: UserIdentity, @Body() body: PortalActionDto) {
    switch (body.action) {
      case 'save':
        return this.portalService.saveDraft(user, {
          id: body.id,
          service: body.service as string,
          data: body.data || {},
          version: body.version,
        });

      case 'submit':
        if (!body.id) throw new BadRequestException('Application ID is required.');
        return this.portalService.submitApplication(user, body.id);

      case 'profile':
        return this.portalService.updateProfile(user, body.data || {});

      case 'read':
        return this.portalService.markActivityRead(user);

      case 'review':
        if (!body.id || !body.status || !body.note) {
          throw new BadRequestException('Application ID, status, and note are required.');
        }
        return this.portalService.reviewApplication(user, {
          id: body.id,
          status: body.status,
          note: body.note,
        });

      default:
        throw new BadRequestException('Unknown portal action.');
    }
  }

  @Post('save')
  @ApiOperation({ summary: 'Save persistent draft application' })
  async saveDraft(@CurrentUser() user: UserIdentity, @Body() body: SaveDraftDto) {
    return this.portalService.saveDraft(user, body);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit application with field and document validations' })
  async submit(@CurrentUser() user: UserIdentity, @Body() body: SubmitApplicationDto) {
    return this.portalService.submitApplication(user, body.id);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Update applicant profile and address' })
  async updateProfile(@CurrentUser() user: UserIdentity, @Body() body: UpdateProfileDto) {
    return this.portalService.updateProfile(user, body.data);
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markRead(@CurrentUser() user: UserIdentity) {
    return this.portalService.markActivityRead(user);
  }

  @Post('review')
  @ApiOperation({ summary: 'Officer reviewer status decision and processing note' })
  async review(@CurrentUser() user: UserIdentity, @Body() body: ReviewActionDto) {
    return this.portalService.reviewApplication(user, body);
  }
}

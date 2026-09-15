import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { DocumentsService } from './documents.service';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { UserIdentity } from '../common/types';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('api/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Download document by query ID (?id=...)' })
  @ApiQuery({ name: 'id', required: true })
  async downloadByQuery(
    @CurrentUser() user: UserIdentity,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    if (!id) throw new BadRequestException('Document ID is required.');
    const { stream, metadata } = await this.documentsService.getDocument(user, id);

    res.setHeader('Content-Type', metadata.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    stream.pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download document by path ID (/:id)' })
  async downloadByPath(
    @CurrentUser() user: UserIdentity,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, metadata } = await this.documentsService.getDocument(user, id);

    res.setHeader('Content-Type', metadata.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    stream.pipe(res);
  }

  @Post()
  @ApiOperation({ summary: 'Upload document (raw stream or multipart)' })
  @ApiQuery({ name: 'application', required: true })
  @ApiQuery({ name: 'kind', required: true })
  @ApiQuery({ name: 'name', required: false })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: UserIdentity,
    @Query('application') application: string,
    @Query('kind') kind: string,
    @Query('name') queryName: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (file) {
      const filename = queryName || file.originalname || 'document';
      return this.documentsService.uploadDocument(
        user,
        application,
        kind,
        filename,
        file.buffer,
        file.mimetype,
      );
    }

    // Direct raw body buffer
    const rawBuffer = req.body instanceof Buffer ? req.body : Buffer.from(req.body || '');
    const filename = (queryName || 'document').slice(0, 200);
    const contentType = req.headers['content-type'];

    return this.documentsService.uploadDocument(
      user,
      application,
      kind,
      filename,
      rawBuffer,
      contentType,
    );
  }
}

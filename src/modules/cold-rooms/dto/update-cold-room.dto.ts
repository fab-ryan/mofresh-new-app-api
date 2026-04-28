import { PartialType } from '@nestjs/swagger';
import { CreateColdRoomDto } from './create-cold-room.dto';

// partial updates for maintenance
export class UpdateColdRoomDto extends PartialType(CreateColdRoomDto) {}

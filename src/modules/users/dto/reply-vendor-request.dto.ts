import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyVendorRequestDto {
  @ApiProperty({ example: 'vendor@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example:
      'Thank you for your request. We have approved your application. Please proceed to registration.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

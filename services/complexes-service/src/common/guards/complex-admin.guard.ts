import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ComplexAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'COMPLEX_ADMIN') {
      throw new ForbiddenException('Only complex admins can perform this action');
    }
    return true;
  }
}

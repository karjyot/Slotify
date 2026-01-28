import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { ROLES_KEY } from '../decorators/role.decorator';
  
  @Injectable()
  export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}
  
    canActivate(context: ExecutionContext): boolean {
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );
  
      if (!requiredRoles) {
        return true;
      }
  
      const request = context.switchToHttp().getRequest();
      const user = request.user;
  
      if (!user) {
        throw new ForbiddenException('User not authenticated');
      }
  
      const hasRole = user.roles?.some(role =>
        requiredRoles.includes(role),
      );
  
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
        );
      }
  
      return true;
    }
  }
  
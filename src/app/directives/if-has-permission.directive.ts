import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../services/permission.service';

@Directive({
  selector: '[ifHasPermission]',
  standalone: true
})
export class IfHasPermissionDirective {
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  @Input() set ifHasPermission(perm: string | string[]) {
    const has = Array.isArray(perm) ? this.permissionService.hasAnyPermission(perm) : this.permissionService.hasPermission(perm);
    if (has) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}
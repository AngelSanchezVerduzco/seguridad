import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Muestra el contenido solo si el usuario tiene permiso. Reacciona al signal
 * `permissions` (p. ej. tras cargar el perfil) y evita duplicar la vista cuando el
 * template pasa un array literal nuevo en cada CD.
 */
@Directive({
  selector: '[ifHasPermission]',
  standalone: true,
})
export class IfHasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);

  private readonly requiredPerm = signal<string | string[] | null>(null);
  private lastPermKey: string | null = null;
  private lastHas: boolean | undefined;

  constructor() {
    effect(() => {
      const perm = this.requiredPerm();
      if (perm === null) return;

      this.permissionService.permissions();

      const has = Array.isArray(perm)
        ? this.permissionService.hasAnyPermission(perm)
        : this.permissionService.hasPermission(perm);

      if (has === this.lastHas) return;
      this.lastHas = has;
      this.viewContainer.clear();
      if (has) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }

  @Input() set ifHasPermission(perm: string | string[]) {
    const key = Array.isArray(perm) ? [...perm].sort().join('\u0001') : String(perm);
    if (key === this.lastPermKey) return;
    this.lastPermKey = key;
    this.requiredPerm.set(Array.isArray(perm) ? [...perm] : perm);
  }
}

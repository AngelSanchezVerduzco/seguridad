import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { GroupStore } from '../../services/group-store';
import { ProfileStore } from '../../services/profile-store';
import { PermissionService } from '../../services/permission.service';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule],
  templateUrl: './group.html',
})
export class Group {
  private profileStore = inject(ProfileStore);
  private permissionService = inject(PermissionService);

  constructor(public groupStore: GroupStore) {}

  isJoined(group: any): boolean {
    const profile = this.profileStore.profile();
    return profile ? group.miembros.includes(profile.email) : false;
  }

  canJoin(): boolean {
    return this.permissionService.hasPermission('group_join');
  }

  isAdmin(): boolean {
    const profile = this.profileStore.profile();
    return profile?.isAdmin ?? false;
  }

  joinGroup(group: any): void {
    const profile = this.profileStore.profile();
    if (profile) {
      this.groupStore.addMember(group.id, profile.email).subscribe();
    }
  }
}

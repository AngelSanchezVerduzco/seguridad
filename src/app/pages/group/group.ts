import { Component } from '@angular/core';
import { TableModule } from 'primeng/table';
import { GroupStore } from '../../services/group-store';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [TableModule],
  templateUrl: './group.html',
})
export class Group {
  constructor(public groupStore: GroupStore) {}
}

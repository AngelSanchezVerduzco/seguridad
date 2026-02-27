import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './home.html',
})
export class Home {
  constructor(private router: Router) {}

  logout(): void {
    this.router.navigate(['/auth/login']);
  }
}

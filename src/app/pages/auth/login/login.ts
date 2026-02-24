import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-login',
  imports: [ButtonModule, InputTextModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

}

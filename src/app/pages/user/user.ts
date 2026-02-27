import { Component } from '@angular/core';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [],
  templateUrl: './user.html',
})
export class User {
  usuario = 'xxx';
  email = 'xxx@xxx.com';
  nombreCompleto = 'Juan Pérez';
  direccion = 'Calle x 123, Colonia Centro';
  fechaNacimiento = '01/01/1990';
  telefono = '5512345678';
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <section class="login-wrapper">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Admin Sign In</mat-card-title>
          <mat-card-subtitle>Enter credentials to continue</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" autocomplete="username" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
            </mat-form-field>

            <button mat-flat-button color="primary" class="full-width" type="submit" [disabled]="form.invalid">
              Sign In
            </button>
          </form>
        </mat-card-content>
      </mat-card>
      <p class="hint">Authentication flow will be implemented in task T041b.</p>
    </section>
  `,
  styles: [
    `
      .login-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100vh - 128px);
        padding: 2rem;
      }

      mat-card {
        width: min(100%, 420px);
      }

      .full-width {
        width: 100%;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }

      .hint {
        margin-top: 1rem;
        text-align: center;
        color: #5f6368;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  protected readonly submitted = signal(false);

  protected onSubmit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitted.set(true);
    // Placeholder for actual auth logic; will be implemented in T041b.
  }
}

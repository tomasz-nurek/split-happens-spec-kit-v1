import { Component, Signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

import { ErrorService } from '../services/error.service';
import { ApplicationError, NavigationLink } from '../types';

const NAV_LINKS: NavigationLink[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Users', path: '/users' },
  { label: 'Groups', path: '/groups' },
  { label: 'Expenses', path: '/expenses' },
  { label: 'Balances', path: '/balances' },
  { label: 'Activity', path: '/activity' }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, NgIf, NgFor],
  template: `
    <mat-toolbar color="primary">
      <a routerLink="/" class="brand" aria-label="Go to home">{{ title }}</a>
      <span class="spacer"></span>
      <nav class="nav-links" aria-label="Primary navigation">
        @for (link of navLinks; track link.path) {
          <a
            mat-button
            [routerLink]="link.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            {{ link.label }}
          </a>
        }
      </nav>
    </mat-toolbar>

    @if (activeError()) {
      <section class="error-banner" role="alert">
        <span>{{ activeError()?.message ?? activeError() }}</span>
        <button mat-button type="button" (click)="clearError()">Dismiss</button>
      </section>
    }

    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: #f7f7f7;
      }

      .brand {
        text-decoration: none;
        color: inherit;
        font-weight: 600;
        letter-spacing: 0.05em;
      }

      .spacer {
        flex: 1;
      }

      .nav-links {
        display: flex;
        gap: 0.5rem;
      }

      .nav-links a.active {
        font-weight: 600;
      }

      .error-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #fdecea;
        color: #7a1c1c;
        border-bottom: 1px solid #f5c2c0;
      }

      .content {
        flex: 1;
        padding: 1.5rem;
      }

      @media (max-width: 768px) {
        mat-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .nav-links {
          width: 100%;
          justify-content: space-between;
        }
      }
    `
  ]
})
export class App {
  private readonly errorService: ErrorService = inject(ErrorService);

  protected readonly navLinks = NAV_LINKS;
  protected readonly title = 'Split Happens Admin';
  protected readonly activeError: Signal<ApplicationError | null> = this.errorService.errorSignal();

  protected clearError(): void {
    this.errorService.clearError();
  }
}

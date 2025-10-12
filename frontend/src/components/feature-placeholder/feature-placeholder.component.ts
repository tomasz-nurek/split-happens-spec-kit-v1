import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  imports: [NgIf],
  template: `
    <section class="placeholder">
      <h1>{{ featureName() }}</h1>
      <p>{{ featureDescription() }}</p>
    </section>
  `,
  styles: [
    `
      .placeholder {
        display: grid;
        place-items: center;
        min-height: calc(100vh - 128px);
        text-align: center;
        padding: 2rem;
        color: #3c4043;
      }

      h1 {
        margin-bottom: 0.5rem;
        font-size: clamp(1.75rem, 2.5vw, 2.5rem);
      }

      p {
        max-width: 420px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  protected readonly featureName = computed(() => this.data()?.['feature'] ?? 'Coming Soon');
  protected readonly featureDescription = computed(
    () => this.data()?.['description'] ?? 'This section is a placeholder until the dedicated task is complete.'
  );
}

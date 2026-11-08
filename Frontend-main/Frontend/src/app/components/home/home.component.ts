import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="home">
      <section class="hero-card">
        <p class="eyebrow">EVENTPLANNER</p>
        <h1>Plan memorable events with less effort.</h1>
        <p class="intro">Organize events, invite your guests, and discover trusted event services in one place.</p>
        <div class="actions">
          <a class="primary" routerLink="/signup">Create an account</a>
          <a class="secondary" routerLink="/signin">Sign in</a>
          <a class="secondary" routerLink="/services">Browse services</a>
        </div>
        <p class="trust-line"><span>✓</span> Simple planning <span>✓</span> Trusted services <span>✓</span> Memorable moments</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .home {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      color: #fffaf0;
      background:
        radial-gradient(circle at 18% 18%, rgba(240, 201, 130, .2), transparent 30%),
        radial-gradient(circle at 85% 80%, rgba(200, 141, 85, .2), transparent 32%),
        linear-gradient(135deg, #173f35 0%, #245849 54%, #8d6a40 100%);
    }
    .hero-card {
      width: min(820px, 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: clamp(36px, 7vw, 76px) clamp(22px, 5vw, 64px);
      border: 1px solid rgba(255, 250, 240, .24);
      border-radius: 28px;
      background: rgba(23, 63, 53, .28);
      box-shadow: 0 24px 70px rgba(13, 35, 29, .25);
      backdrop-filter: blur(8px);
    }
    .eyebrow {
      margin: 0 0 22px;
      color: #f0c982;
      font-size: .82rem;
      font-weight: 800;
      letter-spacing: .24em;
    }
    h1 {
      max-width: 720px;
      margin: 0;
      color: #fffaf0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: clamp(3rem, 8vw, 6.3rem);
      line-height: 1.02;
      letter-spacing: -.055em;
    }
    .intro {
      max-width: 590px;
      margin: 28px 0 0;
      color: rgba(255, 250, 240, .86);
      font-size: clamp(1.05rem, 2vw, 1.25rem);
      line-height: 1.7;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 14px;
      margin-top: 34px;
    }
    a {
      min-width: 145px;
      padding: 14px 24px;
      border-radius: 999px;
      font-weight: 700;
      text-decoration: none;
      transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
    }
    a:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, .2); }
    .primary { color: #173f35; background: #f0c982; }
    .secondary { color: #fffaf0; border: 1px solid rgba(255, 250, 240, .55); background: rgba(255, 250, 240, .08); }
    .secondary:hover { background: rgba(255, 250, 240, .16); }
    .trust-line {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 14px;
      margin: 30px 0 0;
      color: rgba(255, 250, 240, .7);
      font-size: .86rem;
    }
    .trust-line span { color: #f0c982; font-weight: 800; }
    @media (max-width: 600px) {
      .home { padding: 18px; }
      .hero-card { border-radius: 22px; }
      .actions { width: 100%; flex-direction: column; }
      a { width: 100%; }
      .trust-line { line-height: 1.8; }
    }
  `]
})
export class HomeComponent {}

import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/icons";
import { Photo } from "@/components/media";
import { getSessionRow } from "@/lib/auth";
import styles from "./landing.module.css";

export default async function LandingPage() {
  const user = await getSessionRow();
  if (user) redirect(user.onboarding_complete ? "/discover" : "/onboarding");

  return (
    <main className={`shell ${styles.page}`}>
      <div className={styles.grid} />
      <div className={styles.glow} />

      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.brandMark}>
            <Icon name="heart-filled" size={15} />
          </span>
          Connect Me
        </span>
      </header>

      <div className={styles.art}>
        <div className={`${styles.card} ${styles.cardBack}`}>
          <Photo
            src="/seed/m05.jpg"
            seed="landing-m"
            name="Sanket"
            alt=""
          />
          <span className={styles.cardScrim} />
          <span className={styles.cardLabel}>Sanket, 27</span>
        </div>

        <div className={`${styles.card} ${styles.cardFront}`}>
          <Photo
            src="/seed/w03.jpg"
            seed="landing-f"
            name="Sneha"
            alt=""
          />
          <span className={styles.cardScrim} />
          <span className={styles.cardLabel}>Sneha, 25</span>
        </div>

        <span className={`${styles.bubble} ${styles.bubbleMail}`}>
          <Icon name="mail" size={20} />
        </span>
        <span className={`${styles.bubble} ${styles.bubbleStar}`}>
          <Icon name="star-filled" size={17} />
        </span>
        <span className={`${styles.bubble} ${styles.bubbleHeart}`}>
          <Icon name="heart-filled" size={19} />
        </span>
      </div>

      <div className={styles.copy}>
        <h1 className={styles.title}>
          Find Your
          <br />
          <span className="brand-text">Perfect Match</span>
        </h1>
        <p className={styles.sub}>
          Meet real people near you, wherever you are.
        </p>

        <div className={styles.ctaRow}>
          <Link href="/onboarding" className={styles.ctaHeart} aria-label="Get started">
            <Icon name="heart-filled" size={24} />
          </Link>
          <Link href="/onboarding" className={styles.ctaMain}>
            Get Started
            <span className={styles.ctaArrow}>
              <Icon name="chevron" size={20} />
            </span>
          </Link>
        </div>

        <p className={styles.foot}>18+ · Meet people nearby, worldwide</p>
      </div>
    </main>
  );
}

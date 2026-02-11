import pageStyles from '@styles/pages/landing/landing.module.css';
import { KidStarW400 } from '@material-symbols-svg/react/icons/kid-star';
import AppButton from '@components/button/button';
import { StarShineW400 } from '@material-symbols-svg/react/icons/star-shine';
import { AwardStarW400 } from '@material-symbols-svg/react/icons/award-star';

export default function LandingPage() {
  return (
    <div id={'landingWrapper'} className={pageStyles.landingWrapper}>
      <div className={pageStyles.landingHeader}>
        <h1 className={pageStyles.landingHeaderText}>Select User Level</h1>
        <div className={pageStyles.landingHeaderContentWrapper}>
          <AppButton label={'Beginner'} icon={<KidStarW400 />} RootProps={{ 'aria-label': 'Beginner User Type' }} />
          <AppButton
            label={'Intermediate'}
            icon={<StarShineW400 />}
            RootProps={{ 'aria-label': 'Intermediate User Type' }}
          />
          <AppButton
            label={'Advanced'}
            icon={<AwardStarW400 />}
            RootProps={{ 'aria-label': 'Advanced' + ' User Type' }}
            IconProps={{ iconPosition: 'start' }}
          />
        </div>
      </div>
      <div className={pageStyles.landingContentWrapper}></div>
    </div>
  );
}
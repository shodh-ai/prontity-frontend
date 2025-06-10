import type { NextPage } from 'next';
import Image from "next/image";
import styles from './page.module.css'; // Adapted import path

const RegistrationPage: NextPage = () => { // Renamed component
  	return (
    		<div className={styles.q1}>
      			<div className={styles.q1Child} />
      			<div className={styles.q1Item} />
      			<div className={styles.q1Inner} />
      			<Image className={styles.unionIcon} width={1392} height={746} sizes="100vw" alt="" src="/Union.svg" /> {/* Added / for public path */}
      			<div className={styles.ellipseParent}>
        				<div className={styles.groupChild} />
        				<Image className={styles.screenshot20250609At247} width={90} height={90} sizes="100vw" alt="" src="/Screenshot 2025-06-09 at 2.47.05 PM 2.png" /> {/* Added / for public path */}
      				</div>
      			<div className={styles.hiThereImRoxYourPersoParent}>
        				<div className={styles.hiThereImContainer}>
          					<p className={styles.hiThere}>{`Hi there! `}</p>
          					<p className={styles.hiThere}>I'm Rox, your personal AI TOEFL tutor. To get started, what's your name?</p>
            				</div>
            				<div className={styles.nameParent}>
              					<div className={styles.name}>Name</div>
              					<Image className={styles.frameChild} width={32} height={32} sizes="100vw" alt="" src="/Frame 1000011108.svg" /> {/* Added / for public path */}
            				</div>
            		</div>
            		<div className={styles.frameParent}>
              			<Image className={styles.frameIcon} width={24} height={24} sizes="100vw" alt="" src="/Frame.svg" /> {/* Added / for public path */}
              			<div className={styles.rectangleParent}>
                				<div className={styles.frameItem} />
                				<div className={styles.frameInner} />
                				<div className={styles.frameInner} />
                				<div className={styles.frameInner} />
                				<div className={styles.frameInner} />
              				</div>
            		</div>
            </div>);
          			};
          			
export default RegistrationPage; // Export renamed component

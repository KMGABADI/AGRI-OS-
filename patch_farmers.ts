import { app, db, auth } from './src/lib/firebase.js';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';

async function updateFarmers() {
  await signInAnonymously(auth);
  const querySnapshot = await getDocs(collection(db, 'farmers'));
  
  // Nigeria approximate bounds
  const minLat = 4.0;
  const maxLat = 13.0;
  const minLng = 3.0;
  const maxLng = 14.0;
  
  let count = 0;
  const docs = querySnapshot.docs;
  for (const docSnapshot of docs) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lng = minLng + Math.random() * (maxLng - minLng);
    const farmSize = parseFloat((0.5 + Math.random() * 0.5).toFixed(2)); // max 1 hectare
    await updateDoc(doc(db, 'farmers', docSnapshot.id), {
      latitude: lat,
      longitude: lng,
      farmSize: farmSize
    });
    count++;
  }

  if (count === 0) {
    console.log("No farmers found, generating 50 mock farmers...");
    for(let i=0; i<50; i++) {
        const lat = minLat + Math.random() * (maxLat - minLat);
        const lng = minLng + Math.random() * (maxLng - minLng);
        const farmSize = parseFloat((0.5 + Math.random() * 0.5).toFixed(2)); 
        const id = 'FARMER_' + i;
        await setDoc(doc(db, 'farmers', id), {
            id,
            firstName: 'Farmer',
            lastName: 'Mock ' + i,
            latitude: lat,
            longitude: lng,
            farmSize: farmSize,
            state: ['Kano', 'Kaduna', 'Lagos', 'Abuja', 'Oyo'][Math.floor(Math.random()*5)],
            crop: ['Maize', 'Rice', 'Cassava', 'Yam'][Math.floor(Math.random()*4)]
        });
        count++;
    }
  }
  
  console.log(`Done mapping ${count} farmers`);
  process.exit(0);
}
updateFarmers();

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Log a system activity to Firestore for the notification system.
 * @param {'add'|'update'|'delete'} action
 * @param {string} entity  e.g. 'Farmer', 'User', 'Vegetable', 'Map Shape', 'Damage Report'
 * @param {string} label   Human-readable subject, e.g. farmer's name or username
 * @param {string} [performedBy]  Optional: name of the admin who did the action
 */
export const logActivity = async (action, entity, label, performedBy = '') => {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action,       // 'add' | 'update' | 'delete'
      entity,       // 'Farmer' | 'User' | 'Vegetable' | etc.
      label,        // e.g. 'Juan Dela Cruz'
      performedBy,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking — never crash the app over a log failure
    console.warn('Failed to log activity:', err);
  }
};

// Test file to check which icons are available in lucide-react
import { Calendar, Award, Lock } from 'lucide-react';

console.log('Calendar icon:', Calendar ? 'Available' : 'Undefined');
console.log('Award icon:', Award ? 'Available' : 'Undefined');
console.log('Lock icon:', Lock ? 'Available' : 'Undefined');

// Export them to see if they're accessible
export { Calendar, Award, Lock };
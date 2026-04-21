const fs = require('fs');
const path = require('path');

const tsFile = path.resolve('d:/statlab/deploy_bundle/client/src/GenAiCourseData.ts');
const jsonFile = path.resolve('d:/statlab/deploy_bundle/server/data/gen_ai_lessons.json');

const content = fs.readFileSync(tsFile, 'utf8');

// The array starts after 'export const GEN_AI_LESSONS: GenAiLesson[] = ['
const startMarker = 'export const GEN_AI_LESSONS: GenAiLesson[] = ';
const startIndex = content.indexOf(startMarker);

if (startIndex !== -1) {
    let bracketCount = 0;
    let endIndex = -1;
    const arrayPart = content.substring(startIndex + startMarker.length);
    
    // Find matching bracket for the array start '['
    let arrayStart = arrayPart.indexOf('[');
    for (let i = arrayStart; i < arrayPart.length; i++) {
        if (arrayPart[i] === '[') bracketCount++;
        else if (arrayPart[i] === ']') bracketCount--;
        
        if (bracketCount === 0) {
            endIndex = i + 1;
            break;
        }
    }
    
    if (endIndex !== -1) {
        const lessonsStr = arrayPart.substring(arrayStart, endIndex);
        // Use eval safely-ish on a data object (caution: only because I know the content)
        // Or better: just use a tool to convert JS object string to JSON
        try {
            // We need to strip some TS types if any, but GEN_AI_LESSONS is mostly data
            // We can wrap it in an object to eval
            const lessons = eval(`(${lessonsStr})`);
            
            if (!fs.existsSync(path.dirname(jsonFile))) {
                fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
            }
            fs.writeFileSync(jsonFile, JSON.stringify(lessons, null, 2), 'utf8');
            console.log('Successfully exported lessons to JSON');
        } catch (err) {
            console.error('Eval failed:', err);
        }
    } else {
        console.error('Could not find end of array');
    }
} else {
    console.error('Could not find GEN_AI_LESSONS');
}

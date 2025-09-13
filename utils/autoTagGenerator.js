// A simple keyword-based tag generator
const commonKeywords = {
    delay: ['delayed', 'late', 'waiting', 'behind schedule'],
    restaurant: ['restaurant', 'food', 'kitchen', 'order prep'],
    dp_issue: ['delivery partner', 'driver', 'rider', 'vehicle', 'traffic'],
    grouped_order: ['grouped', 'another order', 'multiple deliveries'],
    unassigned: ['unassigned', 'assigning', 'no driver'],
    status: ['status', 'on time', 'tracking'],
    resolved: ['resolved', 'handed over', 'on the way']
};

const generateTags = (text) => {
    const generatedTags = new Set();
    const lowerText = text.toLowerCase();

    for (const tag in commonKeywords) {
        for (const keyword of commonKeywords[tag]) {
            if (lowerText.includes(keyword)) {
                generatedTags.add(tag);
            }
        }
    }
    
    // Add any existing hashtags as tags
    const hashtagRegex = /#(\w+)/g;
    const hashtags = lowerText.match(hashtagRegex);
    if (hashtags) {
        hashtags.forEach(tag => generatedTags.add(tag.replace('#', '')));
    }
    
    return [...generatedTags];
};

module.exports = { generateTags };
# SAS Course Planner Database

## Overview
This course planner uses a JSON database (`courses.json`) to store all course information, making it easy to add, edit, or remove courses without touching the code.

## Database Structure
Each course in `courses.json` has the following properties:

```json
{
    "id": 41004,                  
    "title": "Humanities 9",     
    "code": "HUM-9",             
    "grade": 9,                   
    "credits": 2,               
    "length": "Year",              
    "mandatory": true,           
    "note": "..."
    "description": "...",      
    "prerequisites": "None"        
}
```

## Course Categories
The app organizes courses into 8 credit categories:
1. **English** 
2. **Social Studies**
3. **Mathematics**
4. **Science**
5. **World Languages**
6. **Visual & Performing Arts**
7. **PE & Health**
8. **Tech, CS & Robotics / Catalyst**

## Credit Requirements
The application enforces SAS graduation requirements with real-time credit tracking:

| Credit Category | Required Credits |
|----------------|------------------|
| English | 4.0 |
| Social Studies | 2.0 |
| Mathematics | 2.0 |
| Science | 2.0 |
| World Languages | 2.0 |
| Visual & Performing Arts | 1.0 |
| Physical Education & Health | 1.5 |
| Tech, CS & Robotics / Catalyst | 0.5 |

### Credit Tracking Features
- **Real-time Updates**: Credit counts update automatically when courses are added/removed
- **Visual Indicators**: Green badges for met requirements, red for missing credits
- **Warning System**: Clear warnings when graduation requirements aren't met
- **Progress Display**: Shows current credits vs. required credits for each category

### How It Works
1. Each table column shows the current credits earned in that category
2. Green highlighting indicates requirements are met
3. Red highlighting shows missing credits
4. A warning banner appears if any requirements are not met
5. The system automatically calculates credits from placed courses

## File Structure
```
Courses.io/
├── index.html          # Main application
├── styles.css          # Styling
├── script.js           # Application logic
├── courses.json        # Course database
└── README.md          # This file
```

## Technical Notes
- Courses are loaded asynchronously from `courses.json`
- The admin panel provides a user-friendly interface for course management
- All changes in the admin panel are local until `courses.json` is manually updated
- The application gracefully handles missing or invalid course data
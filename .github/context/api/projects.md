# Projects API (local dev)

## List projects
GET /projects -> 200 OK
Response: ListProjectsRes (array of Project)

## Create project
POST /projects
Body: CreateProjectReq { name: string; code?: string }
Response: CreateProjectRes (Project)

## Get project
GET /projects/:code -> 200 OK


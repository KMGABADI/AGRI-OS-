#!/bin/bash
# D2: Automated backups
# Run this via Cloud Scheduler (e.g. daily) to export Firestore to Cloud Storage

PROJECT_ID="utilitarian-habitat-q4dh4"
BUCKET="gs://${PROJECT_ID}-backups"

echo "Starting Firestore backup to ${BUCKET}..."
gcloud firestore export ${BUCKET} --project=${PROJECT_ID}
echo "Backup initiated."

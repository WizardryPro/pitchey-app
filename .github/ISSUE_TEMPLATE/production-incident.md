---
name: Production Incident
about: Report a production incident or outage
title: '🚨 PRODUCTION INCIDENT: [Brief Description]'
labels: 'production-incident, critical, needs-investigation'
assignees: ''
---

## 🚨 Production Incident Report

**Incident Severity:** <!-- Choose: P1-Critical, P2-High, P3-Medium, P4-Low -->
**Detected At:** <!-- YYYY-MM-DD HH:MM UTC -->
**Reporter:** @<!-- GitHub username -->

## Summary
<!-- Brief description of the incident -->

## Impact
- [ ] Complete outage
- [ ] Partial service degradation  
- [ ] Performance issues
- [ ] Security incident
- [ ] Data integrity issues

**Affected Components:**
- [ ] Frontend (pitchey-5o8.pages.dev)
- [ ] API (pitchey-api-prod.ndlovucavelle.workers.dev)
- [ ] Database
- [ ] Authentication
- [ ] File uploads
- [ ] Other: ___________

**User Impact:**
<!-- How many users affected, what functionality is impacted -->

## Timeline
- **Detection:** <!-- When was this first detected? -->
- **Started:** <!-- When did the incident actually start? -->
- **Status:** <!-- Ongoing, Mitigated, Resolved -->

## Symptoms
<!-- What are users experiencing? -->

## Monitoring Data
- **Error Rate:** ____%
- **Response Time:** ____ms
- **Availability:** ____%

**Related Alerts:**
<!-- Links to monitoring alerts, Sentry errors, etc. -->

## Initial Investigation
<!-- What has been checked so far? -->

## Actions Taken
- [ ] Acknowledged incident
- [ ] Assembled response team
- [ ] Started investigation
- [ ] Applied mitigation
- [ ] Communicated to users
- [ ] Implemented fix
- [ ] Verified resolution

## Communication
- [ ] Team notified
- [ ] Stakeholders informed
- [ ] Users/customers notified
- [ ] Status page updated

## Related Links
- Monitoring Dashboard: 
- Error Logs: 
- Recent Deployments: 
- Similar Incidents: 

## Next Steps
- [ ] Continue monitoring
- [ ] Root cause analysis
- [ ] Post-incident review
- [ ] Update runbooks
- [ ] Prevent recurrence

---

**For P1/P2 incidents:** Immediately notify the on-call engineer and escalate through proper channels.
**For automated incidents:** This may have been created by monitoring automation.
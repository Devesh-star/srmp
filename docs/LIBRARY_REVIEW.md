# CyberRisk Seed Library Review

This document summarizes the seed data for threats, vulnerabilities, and controls for ABC University.

## 1. Threats
| ID | Name | Category | CIA Target | Vulnerabilities |
|---|---|---|---|---|
| thr_phishing | Phishing | Human | C | 2 |
| thr_ransomware | Ransomware | Cyber | A | 3 |
| thr_malware | Malware | Cyber | I | 2 |
| thr_ddos | Distributed Denial of Service (DDoS) | Cyber | A | 2 |
| thr_sql_injection | SQL Injection | Cyber | C | 1 |
| thr_credential_theft | Credential Theft | Human | C | 2 |
| thr_insider_threat | Insider Threat | Human | C | 2 |
| thr_data_breach | Data Breach | Cyber | C | 2 |
| thr_brute_force | Brute Force | Cyber | C | 2 |
| thr_supply_chain_attack | Supply Chain Attack | Cyber | I | 1 |
| thr_api_abuse | API Abuse | Cyber | A | 1 |
| thr_account_takeover | Account Takeover | Cyber | I | 2 |
| thr_hardware_theft | Hardware Theft | Physical | C | 1 |
| thr_fire | Fire | Environmental | A | 2 |
| thr_flood | Flood | Environmental | A | 2 |
| thr_power_failure | Power Failure | Environmental | A | 1 |
| thr_unauthorized_physical_access | Unauthorized Physical Access | Physical | C | 2 |
| thr_data_tampering | Data Tampering | Cyber | I | 2 |
| thr_misconfiguration | Misconfiguration | Human | C | 2 |
| thr_wifi_eavesdropping | Wi-Fi Eavesdropping | Cyber | C | 1 |

## 2. Vulnerabilities
| ID | Name | Severity | Controls |
|---|---|---|---|
| vul_weak_authentication | Weak Authentication | High | 2 |
| vul_missing_mfa | Missing MFA | High | 1 |
| vul_unpatched_software | Unpatched Software | Critical | 2 |
| vul_poor_input_validation | Poor Input Validation | High | 2 |
| vul_weak_access_control | Weak Access Control | High | 4 |
| vul_publicly_exposed_database | Publicly Exposed Database | Critical | 1 |
| vul_weak_encryption | Weak Encryption | Medium | 2 |
| vul_default_credentials | Default Credentials | Critical | 2 |
| vul_no_backup | No Backup | High | 1 |
| vul_poor_network_segmentation | Poor Network Segmentation | High | 1 |
| vul_excessive_privileges | Excessive Privileges | Medium | 1 |
| vul_insecure_api | Insecure API | High | 3 |
| vul_no_logging_monitoring | No Logging or Monitoring | Medium | 2 |
| vul_no_security_awareness | No Security Awareness Training | Medium | 1 |
| vul_unencrypted_wifi | Unencrypted Wi-Fi | High | 2 |
| vul_unmanaged_personal_devices | Unmanaged Personal Devices | Medium | 2 |
| vul_no_physical_access_control | No Physical Access Control | High | 1 |
| vul_no_incident_response_plan | No Incident Response Plan | Medium | 1 |
| vul_no_vendor_review | No Vendor or Third-Party Review | Low | 1 |
| vul_no_power_backup | No Power Backup | High | 1 |

## 3. Controls
| ID | Name | Reduces | Effectiveness | Cost |
|---|---|---|---|---|
| ctl_rate_limiting | Rate Limiting | likelihood | 0.20 | Medium |
| ctl_mfa | Multi-Factor Authentication | likelihood | 0.25 | Medium |
| ctl_input_validation | Input Validation / Parameterized Queries | likelihood | 0.45 | Medium |
| ctl_edr | Endpoint Detection and Response | likelihood | 0.40 | High |
| ctl_offline_backup | Offline Backup | impact | 0.45 | Medium |
| ctl_db_encryption | Database Encryption | impact | 0.20 | Medium |
| ctl_rbac | Role-Based Access Control | likelihood | 0.30 | Medium |
| ctl_network_segmentation | Network Segmentation | impact | 0.30 | High |
| ctl_patch_management | Patch Management | likelihood | 0.40 | Medium |
| ctl_access_monitoring | Access Monitoring | likelihood | 0.10 | Low |
| ctl_security_awareness | Security Awareness Training | likelihood | 0.15 | Low |
| ctl_waf | Web Application Firewall | likelihood | 0.35 | High |
| ctl_password_policy | Password Policy | likelihood | 0.15 | Low |
| ctl_tls_enforcement | TLS Enforcement | likelihood | 0.30 | Low |
| ctl_physical_access_control | Physical Access Control | likelihood | 0.40 | High |
| ctl_ups_generator | UPS and Backup Generators | impact | 0.45 | High |
| ctl_incident_response_plan | Incident Response Plan | impact | 0.20 | Medium |
| ctl_vendor_risk_review | Vendor Risk Review | likelihood | 0.15 | Low |
| ctl_secrets_rotation | Secrets Rotation | likelihood | 0.25 | Medium |
| ctl_device_management | Mobile Device Management (MDM) | likelihood | 0.25 | Medium |

## 4. Mapping Matrix
* thr_phishing -> vul_no_security_awareness, vul_weak_authentication -> ctl_security_awareness, ctl_password_policy, ctl_mfa
* thr_ransomware -> vul_unpatched_software, vul_no_backup, vul_poor_network_segmentation -> ctl_patch_management, ctl_edr, ctl_offline_backup, ctl_network_segmentation
* thr_malware -> vul_unpatched_software, vul_unmanaged_personal_devices -> ctl_patch_management, ctl_edr, ctl_device_management, ctl_network_segmentation
* thr_ddos -> vul_insecure_api, vul_poor_network_segmentation -> ctl_rate_limiting, ctl_waf, ctl_mfa, ctl_network_segmentation
* thr_sql_injection -> vul_poor_input_validation -> ctl_input_validation, ctl_waf
* thr_credential_theft -> vul_missing_mfa, vul_weak_encryption -> ctl_mfa, ctl_tls_enforcement, ctl_db_encryption
* thr_insider_threat -> vul_excessive_privileges, vul_no_logging_monitoring -> ctl_rbac, ctl_access_monitoring, ctl_edr
* thr_data_breach -> vul_weak_access_control, vul_publicly_exposed_database -> ctl_rbac, ctl_mfa, ctl_access_monitoring, ctl_db_encryption, ctl_network_segmentation
* thr_brute_force -> vul_weak_authentication, vul_default_credentials -> ctl_password_policy, ctl_mfa, ctl_secrets_rotation
* thr_supply_chain_attack -> vul_no_vendor_review -> ctl_vendor_risk_review
* thr_api_abuse -> vul_insecure_api -> ctl_rate_limiting, ctl_waf, ctl_mfa
* thr_account_takeover -> vul_missing_mfa, vul_weak_authentication -> ctl_mfa, ctl_password_policy
* thr_hardware_theft -> vul_no_physical_access_control -> ctl_physical_access_control
* thr_fire -> vul_no_backup, vul_no_incident_response_plan -> ctl_offline_backup, ctl_incident_response_plan
* thr_flood -> vul_no_incident_response_plan, vul_no_backup -> ctl_incident_response_plan, ctl_offline_backup
* thr_power_failure -> vul_no_power_backup -> ctl_ups_generator
* thr_unauthorized_physical_access -> vul_no_physical_access_control, vul_no_logging_monitoring -> ctl_physical_access_control, ctl_access_monitoring, ctl_edr
* thr_data_tampering -> vul_weak_access_control, vul_excessive_privileges -> ctl_rbac, ctl_mfa, ctl_access_monitoring, ctl_db_encryption
* thr_misconfiguration -> vul_publicly_exposed_database, vul_default_credentials -> ctl_network_segmentation, ctl_password_policy, ctl_secrets_rotation
* thr_wifi_eavesdropping -> vul_unencrypted_wifi -> ctl_tls_enforcement, ctl_network_segmentation

## 5. Uncertain / please review
* **Effectiveness of Input Validation (0.45)**: Rated very high because it directly prevents SQL injection, but could be adjusted if seen as a baseline.
* **Incident Response Plan reducing Impact (0.20)**: Rated moderate; an IRP doesn't stop an attack but mitigates damage duration.
* **Network Segmentation reducing Impact (0.30)**: Chose impact over likelihood because it limits the blast radius of a breach rather than preventing the initial foothold.

## 6. Controls that reduce both
* **Network Segmentation**: Can reduce likelihood (harder to reach targets) and impact (limits lateral movement). I chose **impact** as primary because its main value is containment.
* **EDR**: Detects (reduces impact time) and prevents (reduces likelihood). I chose **likelihood** as it often blocks malware before execution.

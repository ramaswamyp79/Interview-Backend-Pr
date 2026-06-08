# Cloud Run Load Balancer Runbook

This runbook creates a public HTTPS API entrypoint in front of the Cloud Run backend and then blocks direct public access to the Cloud Run `run.app` URL.

## Current Values

| Item | Value |
| --- | --- |
| Cloud Run service | `interview-backend` |
| Cloud Run region | `asia-south1` |
| Current Cloud Run URL | `https://interview-backend-10476774711.asia-south1.run.app` |
| Reserved load balancer IP | `8.232.140.211` |
| Recommended public API host | `api.<your-domain>` |
| Recommended app API base URL | `https://api.<your-domain>/api` |

Replace `api.<your-domain>` with the real API hostname before creating DNS and certificates.

## Target Architecture

```text
Web app / Desktop app
        |
https://api.<your-domain>
        |
HTTPS Load Balancer + Cloud Armor
        |
Serverless NEG
        |
Cloud Run: interview-backend
```

## 1. Confirm The Reserved IP

In Google Cloud Console:

```text
VPC network -> IP addresses -> External IP addresses
```

Confirm the reserved static IP exists:

```text
8.232.140.211
```

With `gcloud`:

```powershell
gcloud compute addresses list --global
```

If the IP was reserved as regional instead of global, also check:

```powershell
gcloud compute addresses list --regions asia-south1
```

For a global external HTTPS load balancer, use a global static external IP.

## 2. Create DNS Record

In your DNS provider, create:

```text
Type: A
Name: api
Value: 8.232.140.211
TTL: 300 or default
```

Expected public hostname:

```text
api.<your-domain>
```

## 3. Create Google-Managed Classic Certificate

In Google Cloud Console:

```text
Certificate Manager -> Classic certificates -> Create certificate
```

Choose:

| Field | Value |
| --- | --- |
| Type | `Create Google-managed certificate` |
| Name | `backend-pr-api-certificate` |
| Domains | `api.<your-domain>` |

The certificate can stay in `PROVISIONING` until the DNS `A` record points to the load balancer IP and Google verifies the domain.

## 4. Create The HTTPS Load Balancer

In Google Cloud Console:

```text
Network services -> Load balancing -> Create load balancer
```

Choose:

| Field | Value |
| --- | --- |
| Type | `Application Load Balancer (HTTP/HTTPS)` |
| Public or internal | `Public facing (external)` |
| Deployment | `Global external` |
| Load balancer generation | `Classic Application Load Balancer` |
| Name | `interview-backend-api-lb` |

## 5. Configure Frontend

Create one frontend:

| Field | Value |
| --- | --- |
| Protocol | `HTTPS` |
| IP version | `IPv4` |
| IP address | `8.232.140.211` / existing reserved IP |
| Port | `443` |
| Certificate repository | `Use Classic Certificates` |
| Certificate | `backend-pr-api-certificate` |
| SSL policy | `GCP default` |
| HTTP/3 (QUIC) negotiation | `Automatic (default)` |
| Early data (0-RTT) | `Disabled` |
| Client authentication | disabled |
| HTTP keepalive timeout | default |

If available, enable:

```text
Enable HTTP to HTTPS redirect
```

This creates an HTTP listener on port `80` that redirects to HTTPS on port `443`.

## 6. Configure Backend Service

Create a backend service:

| Field | Value |
| --- | --- |
| Backend type | `Serverless network endpoint group` |
| Protocol | `HTTP` |
| Name | `interview-backend-api-backend` |
| Timeout | default unless long-running API calls require more |
| Cloud CDN | disabled for authenticated API routes |

Create a serverless NEG:

| Field | Value |
| --- | --- |
| Name | `interview-backend-neg` |
| Region | `asia-south1` |
| Serverless NEG type | `Cloud Run` |
| Cloud Run service | `interview-backend` |
| URL mask | disabled |

Attach this NEG to `interview-backend-api-backend`.

## 7. Configure Host And Path Rules

For the first setup, route all requests to the backend:

```text
Host: api.<your-domain>
Path: /*
Backend: interview-backend-api-backend
```

If the console asks for a default backend, use:

```text
interview-backend-api-backend
```

## 8. Add Cloud Armor

Create or attach a Cloud Armor policy to the backend service.

Recommended first rules:

| Priority | Rule | Action |
| --- | --- | --- |
| `1000` | Rate limit excessive requests per IP | throttle or deny |
| `2000` | Block obvious unwanted paths, if known | deny |
| `2147483647` | Default rule | allow |

Keep application user authentication in the backend. Cloud Armor protects the edge; it does not replace JWT/Auth0 validation.

## 9. Review And Create

Review:

```text
Frontend: HTTPS 443 on 8.232.140.211
Certificate: backend-pr-api-certificate
Backend: interview-backend-api-backend
NEG: interview-backend-neg -> interview-backend in asia-south1
Host/path: api.<your-domain>/* -> interview-backend-api-backend
```

Click:

```text
Create
```

Wait for the load balancer to become active.

## 10. Test The Load Balancer Path

After DNS and certificate are ready:

```powershell
curl.exe --ssl-no-revoke -i https://api.<your-domain>/api/test
```

Expected:

```text
HTTP/1.1 200 OK
```

or the same successful response currently returned by:

```text
https://interview-backend-10476774711.asia-south1.run.app/api/test
```

## 11. Restrict Direct Cloud Run Access

Only do this after the load balancer URL works.

```powershell
gcloud run services update interview-backend `
  --region asia-south1 `
  --ingress internal-and-cloud-load-balancing
```

After this, direct public access to the Cloud Run URL should be blocked:

```powershell
curl.exe --ssl-no-revoke -i https://interview-backend-10476774711.asia-south1.run.app/api/test
```

The load balancer URL should still work:

```powershell
curl.exe --ssl-no-revoke -i https://api.<your-domain>/api/test
```

## 12. Update Application Configuration

Point web and desktop clients to:

```text
https://api.<your-domain>/api
```

Do not use:

```text
https://interview-backend-10476774711.asia-south1.run.app/api
```

For this backend, keep `CLIENT_ORIGIN` as the frontend origin only, not the backend API URL.

## Rollback

If the load balancer path fails after restricting ingress, temporarily restore direct public Cloud Run access:

```powershell
gcloud run services update interview-backend `
  --region asia-south1 `
  --ingress all
```

Then fix the load balancer, DNS, certificate, or serverless NEG configuration before restricting ingress again.

## Cleanup Notes

Deleting the load balancer does not necessarily delete all related resources.

Check and clean up separately if no longer needed:

```text
VPC network -> IP addresses
Certificate Manager -> Classic certificates
Network services -> Load balancing -> Backend services
Network services -> Load balancing -> Network endpoint groups
Network security -> Cloud Armor
```

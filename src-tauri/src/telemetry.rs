use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Telemetry data stored in app data directory
#[derive(Serialize, Deserialize)]
struct TelemetryData {
    uuid: String,
    created_at: String,
}

/// Payload sent to telemetry server
#[derive(Serialize)]
struct TelemetryPayload {
    #[serde(rename = "appId")]
    app_id: String,
    uuid: String,
    version: String,
    event: String,
    platform: String,
    timestamp: String,
}

/// Sends anonymous telemetry event to the update server.
/// Fails silently if the request fails - this should never block the user.
///
/// # Arguments
/// * `app_data_dir` - Path to the app's data directory
/// * `version` - Current app version
pub async fn send_telemetry_event(
    app_data_dir: PathBuf,
    version: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let uuid = get_or_create_uuid(&app_data_dir)?;

    let payload = TelemetryPayload {
        app_id: "astro-editor".to_string(),
        uuid: uuid.clone(),
        version: version.clone(),
        event: "update_check".to_string(),
        platform: std::env::consts::OS.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    log::info!("Sending telemetry event (UUID: {uuid}, version: {version})");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    client
        .post("https://updateserver.dny.li/event")
        .json(&payload)
        .send()
        .await?;

    log::info!("Telemetry event sent successfully");
    Ok(())
}

/// Gets or creates a UUID for anonymous telemetry tracking.
/// The UUID is stored in telemetry.json in the app data directory and persists across sessions.
///
/// # Arguments
/// * `app_data_dir` - Path to the app's data directory
///
/// # File Format
/// ```json
/// {
///   "uuid": "550e8400-e29b-41d4-a716-446655440000",
///   "created_at": "2025-11-05T15:29:59.206Z"
/// }
/// ```
fn get_or_create_uuid(app_data_dir: &PathBuf) -> Result<String, Box<dyn std::error::Error>> {
    let telemetry_file = app_data_dir.join("telemetry.json");

    if telemetry_file.exists() {
        let contents = std::fs::read_to_string(&telemetry_file)?;
        let data: TelemetryData = serde_json::from_str(&contents)?;
        log::info!(
            "Using existing telemetry UUID: {} (created at: {})",
            data.uuid,
            data.created_at
        );
        Ok(data.uuid)
    } else {
        let uuid = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();
        let data = TelemetryData {
            uuid: uuid.clone(),
            created_at: created_at.clone(),
        };

        std::fs::create_dir_all(app_data_dir)?;

        std::fs::write(&telemetry_file, serde_json::to_string_pretty(&data)?)?;

        log::info!(
            "Created new telemetry UUID: {} at {}",
            uuid,
            telemetry_file.display()
        );
        log::info!("Telemetry file created at: {created_at}");

        Ok(uuid)
    }
}

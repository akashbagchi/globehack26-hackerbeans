from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    navpro_api_key: str = ""
    navpro_base_url: str = "https://api.truckerpath.com"
    insforge_base_url: str = ""
    insforge_anon_key: str = ""
    use_mock_data: bool = True
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    jwt_secret: str = "sauron-dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 12

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    surname: str
    name: str
    patronymic: str

    model_config = {"from_attributes": True}
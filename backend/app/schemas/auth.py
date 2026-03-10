from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterTeacher(BaseModel):
    email: EmailStr
    password: str

    surname: str
    name: str
    patronymic: str = ""
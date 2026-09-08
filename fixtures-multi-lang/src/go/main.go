// fixtures-multi-lang/src/go/main.go
package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
)

type User struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:100" json:"name"`
}

func main() {
	r := gin.Default()
	r.GET("/users/:id", getUser)
	r.POST("/users", createUser)
	fmt.Println("hi")
}

func getUser(c *gin.Context) {}

func createUser(c *gin.Context) {}

func Helper() {}

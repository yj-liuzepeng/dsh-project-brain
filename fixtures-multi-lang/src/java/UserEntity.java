// fixtures-multi-lang/src/java/UserEntity.java
package com.example;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Column;

@Entity
public class UserEntity {
    @Id
    private Long id;
    @Column
    private String name;
}

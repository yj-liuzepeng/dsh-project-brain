// fixtures-multi-lang/src/java/Main.java
package com.example;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class Main {
    @GetMapping("/api/users")
    public List<String> users() {
        return List.of("a");
    }

    private void helper() {}
}

// fixtures-multi-lang/src/rust/lib.rs
use std::collections::HashMap;

pub fn greet(name: &str) -> String {
    format!("hello {}", name)
}

pub struct Config {
    pub name: String,
}

pub trait Handler {
    fn handle(&self) -> String;
}

pub enum Status {
    Active,
    Inactive,
}

fn internal_helper() {}
